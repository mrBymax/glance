import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerEvent, SessionSnapshot } from '@glance/shared';
import { DEFAULT_PROFILE } from '@glance/shared';
import { RESTART_PAUSE_MS, decodeEventData, liveUrls, openLive, parseRecording, playRecording, postIntent, readFeedParams } from './feed';
import mainTake from './recordings/mainTake.json';

const cameraOn: ServerEvent = { type: 'session.state', phase: 'shopping', cameraOn: true };

describe('feed parameters', () => {
  it('reads a live session from the query string', () => {
    expect(readFeedParams('?s=abc&t=xyz')).toEqual({ mode: 'live', sessionId: 'abc', token: 'xyz', apiBase: '' });
  });
  it('reads the origin of the server, with no slash at the end', () => {
    expect(readFeedParams('?s=abc&t=xyz&api=http://localhost:8080/')).toMatchObject({ apiBase: 'http://localhost:8080' });
    expect(readFeedParams('?s=abc&t=xyz&api=/')).toMatchObject({ apiBase: '' });
  });
  it('uses the recording when the session or the token is missing', () => {
    expect(readFeedParams('')).toEqual({ mode: 'recorded' });
    expect(readFeedParams('?s=abc')).toEqual({ mode: 'recorded' });
    expect(readFeedParams('?s=&t=xyz')).toEqual({ mode: 'recorded' });
  });
  it('builds the three URLs of a session, with the token in the query string', () => {
    expect(liveUrls('', 'abc', 't 1')).toEqual({
      snapshot: '/api/sessions/abc?token=t%201',
      events: '/api/sessions/abc/events?token=t%201',
      intents: '/api/sessions/abc/intents?token=t%201' });
  });
});

describe('server-sent data', () => {
  it('decodes a known event', () => {
    expect(decodeEventData(JSON.stringify(cameraOn))).toEqual(cameraOn);
  });
  it('ignores data that is not JSON, and an event type that it does not know', () => {
    expect(decodeEventData('{')).toBeNull();
    expect(decodeEventData('{"type":"glance.exploded"}')).toBeNull();
  });
});

describe('recording', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const steps = [{ afterMs: 100, event: cameraOn }, { afterMs: 300, event: { type: 'glance.unknown' } as ServerEvent }];

  it('accepts the committed recording', () => {
    expect(parseRecording(mainTake).map((s) => s.event.type).slice(0, 3)).toEqual(['session.state', 'caption', 'glance.pending']);
  });
  it('rejects an empty list, an unknown event, and steps out of time order, and names the step', () => {
    expect(() => parseRecording([])).toThrow();
    expect(() => parseRecording([{ afterMs: 0, event: { type: 'glance.exploded' } }])).toThrow(/step 0/);
    expect(() => parseRecording([{ afterMs: 300, event: cameraOn }, { afterMs: 100, event: cameraOn }])).toThrow(/step 1/);
  });
  it('plays each step at its time, then starts again after the pause', () => {
    const onEvent = vi.fn();
    const onRestart = vi.fn();
    playRecording(steps, { onEvent, onRestart });
    vi.advanceTimersByTime(100);
    expect(onEvent).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(onEvent).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(RESTART_PAUSE_MS);
    expect(onRestart).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(onEvent).toHaveBeenCalledTimes(3);
  });
  it('plays no step after a stop', () => {
    const onEvent = vi.fn();
    const stop = playRecording(steps, { onEvent, onRestart: vi.fn() });
    vi.advanceTimersByTime(100);
    stop();
    vi.advanceTimersByTime(10000);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});

describe('live session', () => {
  type Listener = (event: { data?: unknown }) => void;
  class FakeEventSource {
    static last: FakeEventSource;
    listeners = new Map<string, Listener>();
    closed = false;
    constructor(readonly url: string) { FakeEventSource.last = this; }
    addEventListener(type: string, listener: Listener) { this.listeners.set(type, listener); }
    close() { this.closed = true; }
    emit(type: string, data?: unknown) { this.listeners.get(type)?.({ data }); }
  }
  const snapshot = (sessionId: string): SessionSnapshot => ({ sessionId, phase: 'shopping', cameraOn: true, prompt: null,
    cart: { items: [], totalCents: 0 }, profile: DEFAULT_PROFILE, kiosk: null, lastReceipt: null, captions: [] });
  const urls = liveUrls('', 'abc', 'xyz');
  const unknown: ServerEvent = { type: 'glance.unknown' };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  /** A fetch stub whose answers the test gives one at a time. */
  const heldFetch = () => {
    const answers: ((body: unknown) => void)[] = [];
    const fetchFn = vi.fn((_url: string) => new Promise((resolve) => {
      answers.push((body) => resolve({ ok: true, json: async () => body }));
    }));
    vi.stubGlobal('fetch', fetchFn);
    return { answers, fetchFn };
  };

  beforeEach(() => { vi.stubGlobal('EventSource', FakeEventSource); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('gets the snapshot on each open of the stream, and decodes each message', async () => {
    const { answers, fetchFn } = heldFetch();
    const calls: string[] = [];
    openLive(urls, { onSnapshot: (s) => calls.push(s.sessionId), onEvent: (e) => calls.push(e.type) });
    const source = FakeEventSource.last;
    expect(source.url).toBe(urls.events);
    source.emit('open');
    expect(fetchFn).toHaveBeenCalledWith(urls.snapshot);
    answers[0]?.(snapshot('first'));
    await flush();
    source.emit('message', JSON.stringify(cameraOn));
    source.emit('message', '{');
    source.emit('open');
    answers[1]?.(snapshot('second'));
    await flush();
    expect(calls).toEqual(['first', 'session.state', 'second']);
  });
  it('applies again, after the snapshot, each event that arrived while the snapshot was on its way', async () => {
    const { answers } = heldFetch();
    const calls: string[] = [];
    openLive(urls, { onSnapshot: (s) => calls.push(s.sessionId), onEvent: (e) => calls.push(e.type) });
    FakeEventSource.last.emit('open');
    FakeEventSource.last.emit('message', JSON.stringify(unknown));
    answers[0]?.(snapshot('first'));
    await flush();
    expect(calls).toEqual(['glance.unknown', 'first', 'glance.unknown']);
  });
  it('ignores a snapshot that is not valid, the answer to an older request, and each answer after the close', async () => {
    const { answers } = heldFetch();
    const onSnapshot = vi.fn();
    const onEvent = vi.fn();
    const close = openLive(urls, { onSnapshot, onEvent });
    const source = FakeEventSource.last;
    source.emit('open');
    source.emit('open');
    answers[0]?.(snapshot('older'));
    answers[1]?.({ sessionId: '' });
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
    source.emit('open');
    close();
    answers[2]?.(snapshot('late'));
    source.emit('message', JSON.stringify(cameraOn));
    await flush();
    expect(source.closed).toBe(true);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe('postIntent', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const request = { kind: 'yes', source: 'hud', promptId: 'p-1' } as const;

  it('sends the request as JSON and returns true for an accepted request', async () => {
    const fetchFn = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true }));
    vi.stubGlobal('fetch', fetchFn);
    expect(await postIntent('/api/sessions/abc/intents?token=xyz', request)).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith('/api/sessions/abc/intents?token=xyz',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  });
  it('returns false for a refused request and for a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await postIntent('/x', request)).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('no network'); }));
    expect(await postIntent('/x', request)).toBe(false);
  });
});
