import type { EventSourceLike } from '../lib/events';

type StreamEventType = 'open' | 'message' | 'error';

export type FakeSource = EventSourceLike & {
  url: string;
  closed: boolean;
  /** A test sets 2 before an error, to fake a stream that the browser does not open again. */
  readyState: number;
  emit(type: StreamEventType, data?: string): void;
};

export type FakeSources = { create(url: string): FakeSource; sources: FakeSource[] };

export function fakeSources(): FakeSources {
  const sources: FakeSource[] = [];
  const create = (url: string): FakeSource => {
    const listeners: { type: StreamEventType; listener: (event: { data?: unknown }) => void }[] = [];
    const source: FakeSource = {
      url,
      closed: false,
      readyState: 0,
      addEventListener: (type, listener) => { listeners.push({ type, listener }); },
      close: () => { source.closed = true; },
      emit: (type, data) => {
        for (const entry of listeners) if (entry.type === type) entry.listener({ data });
      },
    };
    sources.push(source);
    return source;
  };
  return { create, sources };
}

type FakeCall = { method: string; url: string; body: unknown };

export type FakeFetch = { fetch: typeof fetch; calls: FakeCall[] };

/** A throw in `answer` rejects the call. The default status is 200. */
export function fakeFetch(
  answer: (method: string, url: string, body: unknown) => { status?: number; json?: unknown },
): FakeFetch {
  const calls: FakeCall[] = [];
  const fakeFetchCall = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    const { status = 200, json } = answer(method, url, body);
    // The Response constructor rejects a body for the status 204, so an answer with no JSON gets none.
    return new Response(json === undefined ? null : JSON.stringify(json), { status });
  };
  return { fetch: fakeFetchCall, calls };
}
