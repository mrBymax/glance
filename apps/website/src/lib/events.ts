export type EventSourceLike = {
  addEventListener(type: 'open' | 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
  close(): void;
  /** 2 means closed: the browser does not open the stream again. */
  readonly readyState?: number;
};

const CLOSED = 2;

/**
 * `lost`: the stream dropped, and the browser opens it again by itself.
 * `closed`: the server refused the stream, and the browser stopped. The caller must make a new stream.
 */
export type StreamStatus = 'open' | 'lost' | 'closed';

export type StreamHandlers<T> = { onEvent(event: T): void; onStatus(status: StreamStatus): void };

/**
 * Follows a stream of server-sent events. Each message is `data: <json>` with no event name.
 * It drops a message that is not JSON, and a message for which `parse` returns null.
 * Returns the function that closes the stream.
 */
export function subscribeSse<T>(
  url: string,
  parse: (input: unknown) => T | null,
  handlers: StreamHandlers<T>,
  create: (url: string) => EventSourceLike = (address) => new EventSource(address),
): () => void {
  const source = create(url);
  let isOpen = true;
  source.addEventListener('open', () => {
    if (isOpen) handlers.onStatus('open');
  });
  source.addEventListener('message', (message) => {
    if (!isOpen || typeof message.data !== 'string') return;
    let json: unknown;
    try {
      json = JSON.parse(message.data);
    } catch {
      // The server can be newer than the page. Text that is not JSON is dropped like an unknown event.
      return;
    }
    const event = parse(json);
    if (event !== null) handlers.onEvent(event);
  });
  source.addEventListener('error', () => {
    if (isOpen) handlers.onStatus(source.readyState === CLOSED ? 'closed' : 'lost');
  });
  return () => {
    isOpen = false;
    source.close();
  };
}

export type Timed<T> = { afterMs: number; event: T };

/**
 * Delivers each event of a recording at its time. The recording must be in time order.
 * With `loop`, the run starts again at the time of its last event.
 * Returns the function that stops the run.
 */
export function replay<T>(recording: Timed<T>[], onEvent: (event: T) => void, loop = false): () => void {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const start = () => {
    timers = recording.map((entry) => setTimeout(() => onEvent(entry.event), entry.afterMs));
    const period = recording.at(-1)?.afterMs ?? 0;
    // A period of 0 would start the run again and again in one tick.
    if (loop && period > 0) timers.push(setTimeout(start, period));
  };
  start();
  return () => { for (const timer of timers) clearTimeout(timer); };
}
