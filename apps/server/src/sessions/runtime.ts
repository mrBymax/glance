import type { Caption, KioskRef, Lang, Product, ServerToDevice, SessionSnapshot } from '@glance/shared';
import { ASK_TIMEOUT_MS } from '../ask/ask';
import { type EventBus, sessionTopic } from '../bus';
import type { CatalogIndex } from '../catalog/catalog';
import type { Clock } from '../clock';
import type { SessionRecord, Store } from '../db/store';
import { renderLine } from '../speech/render';
import { step } from './step';
import type { Line, RuleContext, RuleInputBody, SessionState, SpeakEffect } from './types';
import { toSnapshot } from './view';

/** The phone of a session, as the runtime sees it. */
export type DeviceSink = { send(message: ServerToDevice): void; close(): void };

export type RuntimeDeps = {
  clock: Clock;
  catalog: CatalogIndex;
  /** The wait of the rules for the result of a still. Not set means 0, which is off. */
  secondLookWaitMs?: number;
  store: Store;
  bus: EventBus;
  /** The address of the speech clip, or null when no clip exists. */
  clipUrl: (text: string, lang: Lang) => Promise<string | null>;
  startPayment: (session: SessionRuntime, kiosk: KioskRef, totalCents: number) => void;
  /** Answers a question about one product. A call that fails rejects. */
  ask: (question: string, product: Product, lang: Lang) => Promise<string>;
  /**
   * Runs before a stored session becomes a runtime, with each product ID that its state names.
   * The index of the rules lost its scanned products with the old process, and this brings them back.
   */
  restoreProducts?: (productIds: string[]) => Promise<void>;
  /** Runs after each step, with the state from before the step. */
  afterStep: (session: SessionRuntime, before: SessionState) => void;
  /** Gets one line for each intent, for each spoken line, and for each line that the guard dropped. Without it the runtime logs none. */
  log?: (line: string) => void;
};

/**
 * The times that the caller of `dispatch` measured before the rules ran, in milliseconds. null: the path has no such time.
 * frameToResultMs: from the arrival of the frame on the server to the result of its recognition call.
 * resolveMs: the read of the product, for a store item or a barcode.
 */
export type PromptTrace = { frameToResultMs: number | null; resolveMs: number | null };

const KEPT_CAPTIONS = 20;
/** The lines that answer a yes or a no to a product prompt. Each one gets the log line `answer timing`. */
const ANSWER_LINES: ReadonlySet<Line['key']> = new Set(['cart.added', 'cart.removed', 'glance.skipped']);

function isProductPrompt(line: Line): line is Extract<Line, { key: 'glance.new' | 'glance.inCart' }> {
  return line.key === 'glance.new' || line.key === 'glance.inCart';
}
/** The log line of a spoken line holds this number of characters of its text. */
const LOGGED_TEXT_CHARS = 80;

/**
 * One session in this process. It runs the rules for each input and then runs their effects:
 * events to the bus, lines to the phone, the session record to the store.
 */
export class SessionRuntime {
  readonly id: string;
  readonly token: string;
  state: SessionState;

  private sink: DeviceSink | null = null;
  /** Lines and session messages wait here for their clips, so the phone gets them in the order of the rules. */
  private outbox: Promise<void> = Promise.resolve();
  /** One write at a time, so an old record cannot replace a newer one. */
  private writes: Promise<void> = Promise.resolve();
  private speakCount = 0;
  private readonly captions: Caption[] = [];
  private readonly stopListeners: (() => void)[] = [];
  private hasStopped = false;

  constructor(private readonly deps: RuntimeDeps, record: SessionRecord) {
    const { _id, token, kioskId: _kioskId, updatedAt: _updatedAt, ...state } = record;
    this.id = _id;
    this.token = token;
    this.state = state;
  }

  /** True while a phone is attached. */
  get connected(): boolean {
    return this.sink !== null;
  }

  get stopped(): boolean {
    return this.hasStopped;
  }

  /**
   * Runs the rules for one input with the clock time, and then the effects in their order.
   * `trace` goes to the log line `glance timing` of a product prompt that this input opens.
   */
  dispatch(input: RuleInputBody, trace?: PromptTrace): void {
    const before = this.state;
    const next = step(before, { ...input, now: this.deps.clock.now() }, this.ruleContext());
    this.state = next.state;
    if (next.verdict) {
      const { kind, source, promptId, accepted, reason } = next.verdict;
      this.deps.log?.(
        `intent session=${this.id} kind=${kind} source=${source} prompt=${promptId ?? 'none'} accepted=${accepted} reason=${reason ?? 'none'}`,
      );
    }

    let changed = input.type === 'profile.set';
    for (const effect of next.effects) {
      switch (effect.type) {
        case 'event':
          changed = true;
          this.deps.bus.publish(sessionTopic(this.id), effect.event);
          break;
        case 'speak':
          this.speak(effect, trace);
          break;
        case 'session.rest':
          this.enqueue(async () => this.sink?.send({ t: 'session.rest' }));
          break;
        case 'session.end':
          this.enqueue(async () => {
            this.sink?.send({ t: 'session.end' });
            this.stop();
          });
          break;
        case 'payment.start':
          this.deps.startPayment(this, effect.kiosk, effect.totalCents);
          break;
        case 'biometric.request':
          // The outbox keeps the order, so the phone gets the fingerprint line first.
          this.enqueue(async () => this.sink?.send({ t: 'biometric.request' }));
          break;
        case 'ask':
          this.ask(effect.question, effect.product);
          break;
        case 'still.request':
          this.requestStill('label');
          break;
        case 'speak.dropped':
          this.deps.log?.(`speak dropped session=${this.id} key=${effect.line.key} reason=${effect.reason}`);
          break;
      }
    }

    if (changed) this.write();
    this.deps.afterStep(this, before);
  }

  /**
   * Asks the phone for one still. Not through the outbox: the product is in view now, and a line that waits for its
   * clip must not hold the request. With no phone attached, the request goes nowhere.
   */
  requestStill(purpose: Extract<ServerToDevice, { t: 'still.request' }>['purpose']): void {
    this.sink?.send({ t: 'still.request', purpose });
  }

  /**
   * The texts of the lines that a yes and a no to this product prompt speak: "Added ..." with the total that the add
   * gives, and "Skipped." or "Removed ...". The rules are pure, so the runtime runs both answers on the state of now
   * and drops their results.
   */
  private answerTexts(promptId: string): string[] {
    const now = this.deps.clock.now();
    const texts = new Set<string>();
    for (const kind of ['yes', 'no'] as const) {
      // R6: an answer from the phone needs the ID of the prompt alone.
      const answer = step(this.state, { type: 'intent', kind, source: 'phone', promptId, now }, this.ruleContext());
      for (const effect of answer.effects) {
        if (effect.type === 'speak') texts.add(renderLine(effect.line, answer.state.profile));
      }
    }
    return [...texts];
  }

  snapshot(): SessionSnapshot {
    return toSnapshot(this.id, this.state, this.captions, this.ruleContext());
  }

  private ruleContext(): RuleContext {
    return { catalog: this.deps.catalog, secondLookWaitMs: this.deps.secondLookWaitMs ?? 0 };
  }

  /** Makes `sink` the phone of the session. An older sink closes, so one phone gets each message. */
  attach(sink: DeviceSink): void {
    const old = this.sink;
    this.sink = sink;
    if (old && old !== sink) old.close();
  }

  /** Does nothing when another sink took over. */
  detach(sink: DeviceSink): void {
    if (this.sink === sink) this.sink = null;
  }

  /** Resolves when the outbox is empty and each store write is done. */
  async settled(): Promise<void> {
    let outbox: Promise<void>;
    let writes: Promise<void>;
    do {
      outbox = this.outbox;
      writes = this.writes;
      await outbox;
      await writes;
    } while (outbox !== this.outbox || writes !== this.writes);
  }

  /**
   * The listener runs one time when the session stops. If the session has stopped, it runs at once.
   * Returns a function that removes the listener.
   */
  onStop(listener: () => void): () => void {
    if (this.hasStopped) {
      listener();
      return () => undefined;
    }
    this.stopListeners.push(listener);
    return () => {
      const index = this.stopListeners.indexOf(listener);
      if (index >= 0) this.stopListeners.splice(index, 1);
    };
  }

  /** Tells the phone that the session is over, closes its socket, and stops. For a session that a client deletes. */
  end(): void {
    this.enqueue(async () => {
      this.sink?.send({ t: 'session.end' });
      this.sink?.close();
      this.sink = null;
      this.stop();
    });
  }

  /** Runs the stop listeners one time. A stopped session still answers a snapshot, and it writes no record. */
  stop(): void {
    if (this.hasStopped) return;
    this.hasStopped = true;
    for (const listener of this.stopListeners.splice(0)) {
      try {
        listener();
      } catch (error) {
        console.error(`session ${this.id}: a stop listener failed:`, error);
      }
    }
  }

  private speak(effect: SpeakEffect, trace?: PromptTrace): void {
    const startedAt = performance.now();
    const { lang } = this.state.profile;
    // The text is written now, with the profile of this step. Only the clip can take time.
    const text = renderLine(effect.line, this.state.profile);
    this.speakCount += 1;
    const id = `s-${this.speakCount}`;
    const { priority, sound, interrupt, promptId } = effect;
    const answerTexts = promptId !== null && isProductPrompt(effect.line) ? this.answerTexts(promptId) : [];

    this.enqueue(async () => {
      let url: string | null = null;
      try {
        const clip = this.deps.clipUrl(text, lang);
        // The clips of the answer lines are made while the prompt plays, so the answer line waits for no synthesis.
        // The prompt line does not wait for them. A clip that fails here is made again when its line goes out.
        for (const answer of answerTexts) this.deps.clipUrl(answer, lang).catch(() => undefined);
        url = await clip;
      } catch (error) {
        // The line still goes out. The phone reads a line with no clip in its own voice.
        console.error(`session ${this.id}: no clip for the line ${id}:`, error);
      }
      // What the shopper heard, in the order of the phone.
      this.deps.log?.(`speak session=${this.id} key=${effect.line.key} text=${text.slice(0, LOGGED_TEXT_CHARS)} prompt=${promptId ?? 'none'}`);
      // clipMs holds the wait in the outbox and the clip.
      const clipMs = Math.round(performance.now() - startedAt);
      if (isProductPrompt(effect.line)) {
        // The three numbers are the server share of the time from frame to voice.
        this.deps.log?.(
          `glance timing session=${this.id} product=${effect.line.product.id} frameToResultMs=${trace?.frameToResultMs ?? 'none'}`
          + ` resolveMs=${trace?.resolveMs ?? 'none'} clipMs=${clipMs}`,
        );
      } else if (ANSWER_LINES.has(effect.line.key)) {
        this.deps.log?.(`answer timing session=${this.id} key=${effect.line.key} clipMs=${clipMs}`);
      }
      this.sink?.send({ t: 'speak', id, priority, text, lang, url, sound, interrupt, promptId });
      const caption: Caption = { id, text, lang, priority, url };
      this.captions.push(caption);
      if (this.captions.length > KEPT_CAPTIONS) this.captions.shift();
      this.deps.bus.publish(sessionTopic(this.id), { type: 'caption', ...caption });
    });
  }

  /** Gives the rules the answer, or null when the call fails or takes longer than its limit. */
  private ask(question: string, product: Product): void {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ASK_TIMEOUT_MS);
    });
    const answer = this.deps.ask(question, product, this.state.profile.lang).catch((error) => {
      console.error(`session ${this.id}: no answer to a question:`, error);
      return null;
    });
    void Promise.race([answer, late]).then((text) => {
      clearTimeout(timer);
      if (!this.hasStopped) this.dispatch({ type: 'answer', text });
    });
  }

  private enqueue(job: () => Promise<void>): void {
    this.outbox = this.outbox.then(job).catch((error) => {
      console.error(`session ${this.id}: a message to the phone failed:`, error);
    });
  }

  private write(): void {
    if (this.hasStopped) return;
    const record: SessionRecord = {
      ...this.state,
      _id: this.id,
      token: this.token,
      kioskId: this.state.checkout?.kiosk.id ?? null,
      updatedAt: this.deps.clock.now(),
    };
    this.writes = this.writes.then(() => this.deps.store.putSession(record)).catch((error) => {
      console.error(`session ${this.id}: the store write failed:`, error);
    });
  }
}
