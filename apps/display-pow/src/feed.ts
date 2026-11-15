import { SessionSnapshotSchema, parseServerEvent } from '@glance/shared';
import type { ServerEvent, SessionSnapshot, WebIntentRequest } from '@glance/shared';

export type FeedParams = { mode: 'recorded' } | { mode: 'live'; sessionId: string; token: string; apiBase: string };

/** Reads the query names `s`, `t`, and `api`. The mirror page of the website uses the same `s` and `t`. */
export function readFeedParams(search: string): FeedParams {
  const query = new URLSearchParams(search);
  const sessionId = query.get('s');
  const token = query.get('t');
  if (!sessionId || !token) return { mode: 'recorded' };
  // The empty text means the origin of the page.
  const apiBase = (query.get('api') ?? '').replace(/\/+$/, '');
  return { mode: 'live', sessionId, token, apiBase };
}

export type LiveUrls = { snapshot: string; events: string; intents: string };

export function liveUrls(apiBase: string, sessionId: string, token: string): LiveUrls {
  const session = `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}`;
  const query = `?token=${encodeURIComponent(token)}`;
  return { snapshot: `${session}${query}`, events: `${session}/events${query}`, intents: `${session}/intents${query}` };
}

/** Returns null for text that is not JSON, and for an event type of a newer server. */
export function decodeEventData(data: string): ServerEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  return parseServerEvent(json);
}

export type Timed<T> = { afterMs: number; event: T };

/** Throws an error that names the step for an unknown event, and for a step that is earlier than the step before it. */
export function parseRecording(input: unknown): Timed<ServerEvent>[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('A recording is a list with one step or more.');
  }
  let lastMs = 0;
  return input.map((step: unknown, index) => {
    const { afterMs, event: rawEvent } = (step ?? {}) as { afterMs?: unknown; event?: unknown };
    const event = parseServerEvent(rawEvent);
    if (event === null) throw new Error(`step ${index}: the event is not a server event.`);
    if (typeof afterMs !== 'number' || !Number.isFinite(afterMs) || afterMs < lastMs) {
      throw new Error(`step ${index}: afterMs must be a number that is not lower than the step before it.`);
    }
    lastMs = afterMs;
    return { afterMs, event };
  });
}

export const RESTART_PAUSE_MS = 4000;

/** Plays each step at its time, again and again, with a pause before each new start. Returns the stop function. */
export function playRecording(
  steps: readonly Timed<ServerEvent>[],
  handlers: { onEvent: (event: ServerEvent) => void; onRestart: () => void },
): () => void {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const start = () => {
    timers = steps.map((step) => setTimeout(() => handlers.onEvent(step.event), step.afterMs));
    const lastMs = steps.at(-1)?.afterMs ?? 0;
    timers.push(setTimeout(() => {
      handlers.onRestart();
      start();
    }, lastMs + RESTART_PAUSE_MS));
  };
  start();
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}

/**
 * Follows the events of a live session. It gets the snapshot after each open of the stream,
 * so a reconnect gives a fresh state. Returns the function that closes the stream.
 */
export function openLive(
  urls: LiveUrls,
  handlers: { onSnapshot: (snapshot: SessionSnapshot) => void; onEvent: (event: ServerEvent) => void },
): () => void {
  const source = new EventSource(urls.events);
  let isOpen = true;
  // Counts the snapshot requests, so that the answer to an older request has no effect.
  let request = 0;
  // The events that arrived while a snapshot request was open. The snapshot can be older than these events.
  let sinceRequest: ServerEvent[] | null = null;

  source.addEventListener('open', () => {
    const mine = ++request;
    sinceRequest = [];
    fetch(urls.snapshot)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (!isOpen || mine !== request) return;
        const late = sinceRequest ?? [];
        sinceRequest = null;
        const snapshot = SessionSnapshotSchema.safeParse(body);
        if (!snapshot.success) return;
        handlers.onSnapshot(snapshot.data);
        for (const event of late) handlers.onEvent(event);
      })
      .catch(() => {
        // The state stays as it is. The next open of the stream asks for the snapshot again.
        if (mine === request) sinceRequest = null;
      });
  });
  source.addEventListener('message', (message: MessageEvent) => {
    if (!isOpen || typeof message.data !== 'string') return;
    const event = decodeEventData(message.data);
    if (event === null) return;
    sinceRequest?.push(event);
    handlers.onEvent(event);
  });
  return () => {
    isOpen = false;
    source.close();
  };
}

/** Returns true if the server accepted the request. The result of the intent arrives as events. */
export async function postIntent(url: string, request: WebIntentRequest): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.ok;
  } catch {
    return false;
  }
}
