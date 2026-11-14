import { DEFAULT_PROFILE, EMPTY_CART, type NativeState, type NativeToPage } from '@glance/shared';
import created from '@glance/shared/fixtures/rest/CreateSessionResponse.json';
import { expect, it, vi } from 'vitest';
import { eventFixture, SNAPSHOT } from '../debug/fixtures';
import { fakeFetch, fakeSources } from '../test/fakes';
import { BrowserBridge } from './browserBridge';
import { NATIVE_NEW, NATIVE_READY } from './fakeNative';

const path = `/api/sessions/${encodeURIComponent(created.sessionId)}`;
const q = `?token=${encodeURIComponent(created.token)}`;

const listen = (bridge: BrowserBridge) => {
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  return seen;
};

const offline = () => {
  const bridge = new BrowserBridge({ apiBase: null });
  return { bridge, seen: listen(bridge) };
};

const online = () => {
  const http = fakeFetch((method) => {
    if (method === 'POST') return { json: created };
    if (method === 'GET') return { json: SNAPSHOT };
    return { status: 204 };
  });
  const sources = fakeSources();
  const bridge = new BrowserBridge({ apiBase: '', fetch: http.fetch, createEventSource: sources.create });
  return { bridge, seen: listen(bridge), http, sources };
};

const started = async () => {
  const context = online();
  context.bridge.send({ t: 'session.start' });
  await vi.waitFor(() => expect(context.sources.sources).toHaveLength(1));
  context.sources.sources[0]?.emit('open');
  await vi.waitFor(() => expect(context.seen).toContainEqual({ t: 'snapshot', session: SNAPSHOT }));
  return context;
};

const lastNative = (seen: NativeToPage[]): NativeState | undefined =>
  seen.filter((message) => message.t === 'native.state').at(-1)?.state;

it('answers ui.ready with the native state and the profile', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'ui.ready' });
  expect(seen).toEqual([{ t: 'native.state', state: NATIVE_NEW }, { t: 'profile', profile: DEFAULT_PROFILE }]);
});
it('fakes the link step and the camera permission', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'setup.register' });
  bridge.send({ t: 'setup.requestCamera' });
  expect(lastNative(seen)).toEqual(NATIVE_READY);
});
it('starts a session with no server and no network call', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'session.start' });
  expect(lastNative(seen)).toMatchObject({ session: 'started', stream: 'streaming' });
  expect(seen.at(-1)).toMatchObject({ t: 'snapshot', session: { sessionId: 'offline', phase: 'shopping', cart: EMPTY_CART } });
});
it('creates a session, opens the event stream, and loads the snapshot', async () => {
  const { bridge, seen, http, sources } = await started();
  expect(http.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['POST /api/sessions', `GET ${path}${q}`]);
  expect(http.calls[0]?.body).toEqual({ profile: DEFAULT_PROFILE });
  expect(sources.sources[0]?.url).toBe(`${path}/events${q}`);
  expect(seen).toContainEqual({ t: 'snapshot', session: SNAPSHOT });
  expect(lastNative(seen)).toMatchObject({ session: 'started', stream: 'streaming', network: 'online' });
  expect(bridge.sessionQuery()).toBe(`s=${encodeURIComponent(created.sessionId)}&t=${encodeURIComponent(created.token)}`);
});
it('creates one session for two fast start messages', async () => {
  const { bridge, http, sources } = online();
  bridge.send({ t: 'session.start' });
  bridge.send({ t: 'session.start' });
  await vi.waitFor(() => expect(sources.sources).toHaveLength(1));
  expect(http.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
});
it('relays each event of the stream and drops what it cannot parse', async () => {
  const { seen, sources } = await started();
  sources.sources[0]?.emit('message', JSON.stringify(eventFixture('glance.pending')));
  sources.sources[0]?.emit('message', 'not json');
  sources.sources[0]?.emit('message', JSON.stringify({ type: 'glance.exploded' }));
  expect(seen.filter((message) => message.t === 'event')).toEqual([{ t: 'event', event: eventFixture('glance.pending') }]);
});
it('sends each action of the page to its path', async () => {
  const { bridge, http } = await started();
  bridge.send({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  bridge.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 0 });
  bridge.send({ t: 'profile.set', patch: { detail: 'brief' } });
  bridge.send({ t: 'session.end' });
  await vi.waitFor(() => expect(http.calls).toHaveLength(6));
  expect(http.calls.slice(2)).toEqual([
    { method: 'POST', url: `${path}/intents${q}`, body: { kind: 'yes', source: 'phone', promptId: 'p-0001' } },
    { method: 'POST', url: `${path}/cart${q}`, body: { productId: 'oat-drink-1l', qty: 0 } },
    { method: 'PATCH', url: `${path}/profile${q}`, body: { detail: 'brief' } },
    { method: 'POST', url: `${path}/intents${q}`, body: { kind: 'stop', source: 'phone' } },
  ]);
});
it('merges a profile patch and sends the new profile to the page', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'profile.set', patch: { detail: 'brief' } });
  expect(seen).toEqual([{ t: 'profile', profile: { ...DEFAULT_PROFILE, detail: 'brief' } }]);
  expect(DEFAULT_PROFILE.detail).toBe('standard');
});
it('deletes the session and forgets it', async () => {
  const { bridge, http, sources } = await started();
  bridge.send({ t: 'data.delete' });
  await vi.waitFor(() => expect(http.calls.at(-1)).toMatchObject({ method: 'DELETE', url: `${path}${q}` }));
  expect(sources.sources[0]?.closed).toBe(true);
  expect(bridge.sessionQuery()).toBeNull();
});
it('follows the camera state of the server and forgets a session that ended', async () => {
  const { bridge, seen, sources } = await started();
  sources.sources[0]?.emit('message', JSON.stringify({ type: 'session.state', phase: 'ended', cameraOn: false }));
  expect(lastNative(seen)).toMatchObject({ stream: 'stopped' });
  expect(sources.sources[0]?.closed).toBe(true);
  expect(bridge.sessionQuery()).toBeNull();
});
it('says offline while the stream is lost, then loads the snapshot again', async () => {
  const { seen, http, sources } = await started();
  sources.sources[0]?.emit('error');
  expect(lastNative(seen)?.network).toBe('offline');
  sources.sources[0]?.emit('open');
  await vi.waitFor(() => expect(http.calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  expect(lastNative(seen)?.network).toBe('online');
});
it('says offline when the server does not answer', async () => {
  const http = fakeFetch(() => { throw new Error('down'); });
  const bridge = new BrowserBridge({ apiBase: '', fetch: http.fetch, createEventSource: fakeSources().create });
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'session.start' });
  await vi.waitFor(() => expect(lastNative(seen)).toMatchObject({ network: 'offline', session: 'idle' }));
});
it('logs one line for an answer with an error status, with no token in it', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const http = fakeFetch((method, url) => (url.endsWith('/api/sessions') && method === 'POST' ? { json: created } : { status: 404 }));
  const sources = fakeSources();
  const bridge = new BrowserBridge({ apiBase: '', fetch: http.fetch, createEventSource: sources.create });
  bridge.send({ t: 'session.start' });
  await vi.waitFor(() => expect(sources.sources).toHaveLength(1));
  bridge.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 2 });
  await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(`bridge: POST ${path}/cart failed with 404`));
  warn.mockRestore();
});
it('keeps each sent message and delivers an injected one', () => {
  const { bridge, seen } = offline();
  bridge.send({ t: 'haptic', pattern: 'added' });
  bridge.inject({ t: 'profile', profile: DEFAULT_PROFILE });
  expect(bridge.sent).toEqual([{ t: 'haptic', pattern: 'added' }]);
  expect(seen).toEqual([{ t: 'profile', profile: DEFAULT_PROFILE }]);
});
