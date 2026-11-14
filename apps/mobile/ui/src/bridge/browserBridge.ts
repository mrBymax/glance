import {
  CreateSessionResponseSchema, DEFAULT_PROFILE, parseServerEvent, SessionSnapshotSchema,
  type GlanceBridge, type NativeState, type NativeToPage, type PageToNative, type Profile, type SessionSnapshot,
} from '@glance/shared';
import { NATIVE_NEW, NATIVE_READY } from './fakeNative';

export type EventSourceLike = {
  addEventListener(type: 'open' | 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
  close(): void;
};

export type BrowserBridgeOptions = {
  /** The origin of the server, or an empty text for the origin of the page. With null the bridge makes no network call. */
  apiBase: string | null;
  /** The start state. The default is NATIVE_NEW. */
  nativeState?: NativeState;
  fetch?: typeof fetch;
  createEventSource?: (url: string) => EventSourceLike;
};

type ServerSession = { id: string; token: string; source: EventSourceLike | null };

const enc = encodeURIComponent;

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // A proxy can answer with an HTML page. The schema check of the caller rejects null.
    return null;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function offlineSnapshot(profile: Profile): SessionSnapshot {
  return {
    sessionId: 'offline',
    phase: 'shopping',
    cameraOn: true,
    prompt: null,
    cart: { items: [], totalCents: 0 },
    profile,
    kiosk: null,
    lastReceipt: null,
    captions: [],
  };
}

/**
 * The bridge in a desktop browser. It fakes the native state of the Android app.
 * With a server address it also does the work of the app: it sends each action to the REST paths and reads the event stream.
 */
export class BrowserBridge implements GlanceBridge {
  private readonly apiBase: string | null;
  private readonly fetch: typeof fetch;
  private readonly createEventSource: (url: string) => EventSourceLike;
  private readonly listeners = new Set<(message: NativeToPage) => void>();
  private readonly sentMessages: PageToNative[] = [];
  private native: NativeState;
  private profile: Profile = DEFAULT_PROFILE;
  private session: ServerSession | null = null;
  // True from a stream error to the next open of the stream. An answer to a REST call does not end it.
  private streamLost = false;

  constructor(options: BrowserBridgeOptions) {
    this.apiBase = options.apiBase;
    this.native = options.nativeState ?? NATIVE_NEW;
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.createEventSource = options.createEventSource ?? ((url) => new EventSource(url));
  }

  /** Each message of the page, oldest first. */
  get sent(): readonly PageToNative[] {
    return this.sentMessages;
  }

  /** Returns `s=<sessionId>&t=<token>` while a server session exists. The mirror page takes these two flags. */
  sessionQuery(): string | null {
    return this.session ? `s=${enc(this.session.id)}&t=${enc(this.session.token)}` : null;
  }

  subscribe(listener: (message: NativeToPage) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Delivers a message to the page, for tests and the debug panel. */
  inject(message: NativeToPage): void {
    for (const listener of [...this.listeners]) listener(message);
  }

  send(message: PageToNative): void {
    this.sentMessages.push(message);
    switch (message.t) {
      case 'ui.ready':
        this.inject({ t: 'native.state', state: this.native });
        this.inject({ t: 'profile', profile: this.profile });
        return;
      case 'setup.register':
        this.setNative({ registration: 'registered', device: NATIVE_READY.device });
        return;
      case 'setup.requestCamera':
        this.setNative({ cameraPermission: 'granted' });
        return;
      case 'setup.openUpdate':
      case 'pocket.set':
      case 'haptic':
        return;
      case 'session.start':
        this.startSession();
        return;
      case 'intent':
        this.post('/intents', { kind: message.kind, source: 'phone', promptId: message.promptId });
        return;
      case 'cart.edit':
        this.post('/cart', { productId: message.productId, qty: message.qty });
        return;
      case 'profile.set':
        if (this.session) void this.request('PATCH', `${this.pathOf(this.session)}/profile`, message.patch, this.session.token);
        this.profile = { ...this.profile, ...message.patch };
        this.inject({ t: 'profile', profile: this.profile });
        return;
      case 'session.end':
        this.post('/intents', { kind: 'stop', source: 'phone' });
        this.setNative({ session: 'stopped', stream: 'stopped' });
        return;
      case 'data.delete':
        this.deleteData();
        return;
    }
  }

  private setNative(change: Partial<NativeState>): void {
    const keys = Object.keys(change) as (keyof NativeState)[];
    if (keys.every((key) => this.native[key] === change[key])) return;
    this.native = { ...this.native, ...change };
    this.inject({ t: 'native.state', state: this.native });
  }

  private pathOf(session: ServerSession): string {
    return `/api/sessions/${enc(session.id)}`;
  }

  private post(suffix: string, body: unknown): void {
    if (this.session) void this.request('POST', `${this.pathOf(this.session)}${suffix}`, body, this.session.token);
  }

  /** Returns the answer of the server, or null when no answer came. */
  private async request(method: string, path: string, body?: unknown, token?: string): Promise<Response | null> {
    const query = token === undefined ? '' : `?token=${enc(token)}`;
    const init: RequestInit = body === undefined
      ? { method }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    let response: Response;
    try {
      response = await this.fetch(`${this.apiBase}${path}${query}`, init);
    } catch {
      this.setNative({ network: 'offline' });
      return null;
    }
    if (!this.streamLost) this.setNative({ network: 'online' });
    // The line holds the path only. The query holds the token of the session.
    if (response.status >= 400) console.warn(`bridge: ${method} ${path} failed with ${response.status}`);
    return response;
  }

  private startSession(): void {
    if (this.apiBase === null) {
      this.setNative({ session: 'started', stream: 'streaming' });
      this.inject({ t: 'snapshot', session: offlineSnapshot(this.profile) });
      return;
    }
    if (this.session) {
      this.setNative({ session: 'started', stream: 'streaming' });
      return;
    }
    // A second start message while the first POST is open must not make a second session.
    if (this.native.session === 'starting') return;
    this.setNative({ session: 'starting' });
    void this.createSession();
  }

  private async createSession(): Promise<void> {
    const response = await this.request('POST', '/api/sessions', { profile: this.profile });
    const created = response?.ok ? CreateSessionResponseSchema.safeParse(await jsonOf(response)) : null;
    if (!created?.success) {
      this.setNative({ session: 'idle' });
      return;
    }
    const session: ServerSession = { id: created.data.sessionId, token: created.data.token, source: null };
    this.session = session;
    this.setNative({ session: 'started', stream: 'streaming' });
    this.openStream(session);
  }

  // The stream opens before the first snapshot, so that no event is lost between the two.
  private openStream(session: ServerSession): void {
    const source = this.createEventSource(`${this.apiBase}${this.pathOf(session)}/events?token=${enc(session.token)}`);
    session.source = source;
    const isCurrent = () => this.session === session;
    source.addEventListener('open', () => {
      if (!isCurrent()) return;
      this.streamLost = false;
      this.setNative({ network: 'online' });
      void this.loadSnapshot(session);
    });
    source.addEventListener('message', (event) => {
      if (isCurrent() && typeof event.data === 'string') this.receive(event.data);
    });
    source.addEventListener('error', () => {
      if (!isCurrent()) return;
      this.streamLost = true;
      this.setNative({ network: 'offline' });
    });
  }

  private async loadSnapshot(session: ServerSession): Promise<void> {
    const response = await this.request('GET', this.pathOf(session), undefined, session.token);
    if (!response?.ok || this.session !== session) return;
    const snapshot = SessionSnapshotSchema.safeParse(await jsonOf(response));
    if (snapshot.success && this.session === session) this.inject({ t: 'snapshot', session: snapshot.data });
  }

  private receive(text: string): void {
    const event = parseServerEvent(parseJson(text));
    if (!event) return;
    this.inject({ t: 'event', event });
    if (event.type !== 'session.state') return;
    if (event.phase === 'paid' || event.phase === 'ended') {
      this.forgetSession();
      this.setNative({ session: 'stopped', stream: 'stopped' });
    } else {
      this.setNative({ stream: event.cameraOn ? 'streaming' : 'stopped' });
    }
  }

  private forgetSession(): void {
    this.session?.source?.close();
    this.session = null;
    this.streamLost = false;
  }

  private deleteData(): void {
    if (this.session) void this.request('DELETE', this.pathOf(this.session), undefined, this.session.token);
    this.forgetSession();
    // The Android app sends the profile and then the native state after it deletes the data.
    this.profile = DEFAULT_PROFILE;
    this.inject({ t: 'profile', profile: this.profile });
    this.setNative({ session: 'idle', stream: 'stopped' });
  }
}
