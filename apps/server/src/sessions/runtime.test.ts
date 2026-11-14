import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type ServerEvent, type ServerToDevice, TIMING } from '@glance/shared';
import { EventBus, sessionTopic } from '../bus';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { systemClock } from '../clock';
import { MemoryStore } from '../db/memory';
import { NO_RESULT } from '../recognition/result';
import { KIOSK, STREAMING } from './harness';
import { SessionRegistry } from './registry';
import type { DeviceSink, RuntimeDeps, SessionRuntime } from './runtime';
import type { RuleInputBody } from './types';

const products = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
const help: RuleInputBody = { type: 'intent', kind: 'help', source: 'phone' };
const glanceText = 'Oat drink, one litre, one eighty-nine. Nod to add.';

type TestSink = DeviceSink & { sent: ServerToDevice[]; closed: boolean };
function testSink(): TestSink {
  const sink: TestSink = {
    sent: [],
    closed: false,
    send: (message) => { sink.sent.push(message); },
    close: () => { sink.closed = true; },
  };
  return sink;
}

let time: number;
let store: MemoryStore;
let clipDelays: number[];
let startPayment: ReturnType<typeof vi.fn<RuntimeDeps['startPayment']>>;
let afterStep: ReturnType<typeof vi.fn<RuntimeDeps['afterStep']>>;
let deps: RuntimeDeps;
let registry: SessionRegistry;
let session: SessionRuntime;
let busEvents: ServerEvent[];
let sink: TestSink;
let other: TestSink;

beforeEach(async () => {
  time = 1_000_000;
  store = new MemoryStore(products);
  clipDelays = [];
  startPayment = vi.fn<RuntimeDeps['startPayment']>();
  afterStep = vi.fn<RuntimeDeps['afterStep']>();
  deps = {
    clock: { now: () => time },
    catalog: indexCatalog(products),
    store,
    bus: new EventBus(),
    // Each call takes the next delay of the list. With an empty list the clip comes at once.
    clipUrl: async () => {
      const delay = clipDelays.shift() ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return null;
    },
    startPayment,
    afterStep,
  };
  registry = new SessionRegistry(deps);
  session = await registry.create();
  busEvents = [];
  deps.bus.subscribe(sessionTopic(session.id), (message) => busEvents.push(message as ServerEvent));
  sink = testSink();
  other = testSink();
});
afterEach(() => {
  registry.stop();
  vi.useRealTimers();
});

it('runs the rules with the clock time and publishes the events', () => {
  session.dispatch(seeOat);
  expect(busEvents.map((e) => e.type)).toEqual(['glance.pending']);
  expect(session.state.seen['oat-drink-1l']).toBe(time);
});
it('sends a line to the phone and a caption to the bus', async () => {
  session.attach(sink); session.dispatch(seeOat); await session.settled();
  expect(sink.sent).toEqual([{
    t: 'speak', id: 's-1', priority: 'normal', text: glanceText, lang: 'en', url: null,
    sound: null, interrupt: true, promptId: 'p-0001',
  }]);
  expect(busEvents.at(-1)).toEqual({ type: 'caption', id: 's-1', text: glanceText, lang: 'en', priority: 'normal', url: null });
});
it('keeps the order of the lines when an early clip is slow', async () => {
  clipDelays = [50, 0];
  session.attach(sink); session.dispatch(seeOat); session.dispatch(help);
  await session.settled();
  expect(sink.sent.map((m) => (m.t === 'speak' ? m.id : m.t))).toEqual(['s-1', 's-2']);
});
it('sends the line with no clip when the clip fails', async () => {
  deps.clipUrl = async () => { throw new Error('no credits'); };
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  session.attach(sink); session.dispatch(seeOat); await session.settled();
  expect(sink.sent).toMatchObject([{ t: 'speak', text: glanceText, url: null, promptId: 'p-0001' }]);
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});
it('sends session.end after the last line, and then stops', async () => {
  const stopped = vi.fn();
  session.onStop(stopped);
  session.attach(sink); session.dispatch({ type: 'intent', kind: 'stop', source: 'phone' });
  expect(stopped).not.toHaveBeenCalled();
  await session.settled();
  expect(sink.sent.map((m) => m.t)).toEqual(['speak', 'session.end']);
  expect(stopped).toHaveBeenCalledTimes(1);
  expect(registry.live()).toEqual([]);
  session.stop();
  expect(stopped).toHaveBeenCalledTimes(1);
});
it('runs a stop listener at once when the session has stopped', () => {
  session.stop();
  const late = vi.fn();
  session.onStop(late);
  expect(late).toHaveBeenCalledTimes(1);
});
it('keeps the last 20 captions, oldest first', async () => {
  for (let i = 0; i < 25; i += 1) session.dispatch(help);
  await session.settled();
  expect(session.snapshot().captions.map((c) => c.id)).toEqual(Array.from({ length: 20 }, (_, i) => `s-${i + 6}`));
});
it('publishes events and captions with no phone, and drops the device messages', async () => {
  session.dispatch({ type: 'intent', kind: 'stop', source: 'phone' }); await session.settled();
  expect(busEvents.map((e) => e.type)).toEqual(['session.state', 'caption']);
});
it('stores the session after an event and not after a sighting', async () => {
  const put = vi.spyOn(store, 'putSession');
  session.dispatch(seeOat); await session.settled();
  expect(put).toHaveBeenCalledTimes(1);
  session.dispatch(seeOat); await session.settled();
  expect(put).toHaveBeenCalledTimes(1);
});
it('stores the session after a profile patch', async () => {
  session.dispatch({ type: 'profile.set', patch: { detail: 'brief' } }); await session.settled();
  expect((await store.getSession(session.id))!.profile.detail).toBe('brief');
});
it('logs a store write that fails and takes the next input', async () => {
  vi.spyOn(store, 'putSession').mockRejectedValueOnce(new Error('disk full'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  session.dispatch(seeOat); await session.settled();
  expect(error).toHaveBeenCalledTimes(1);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' }); await session.settled();
  expect((await store.getSession(session.id))!.cart.totalCents).toBe(189);
  error.mockRestore();
});
it('a second sink closes the first', () => {
  session.attach(sink); session.attach(other);
  expect(sink.closed).toBe(true);
  expect(session.connected).toBe(true);
});
it('keeps the new sink when the old sink detaches', () => {
  session.attach(sink); session.attach(other); session.detach(sink);
  expect(session.connected).toBe(true);
  session.detach(other);
  expect(session.connected).toBe(false);
});
it('starts the payment and calls afterStep', () => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  session.dispatch({ type: 'prompt.done', promptId: 'p-0002' });
  session.dispatch({ type: 'intent', kind: 'yes', source: 'voice', promptId: 'p-0002' });
  expect(startPayment).toHaveBeenCalledWith(session, KIOSK, 189);
  expect(afterStep).toHaveBeenCalled();
  expect(afterStep.mock.calls[0]![1].cart.items).toEqual([]);
});
it('sends a tick to each live session each second', async () => {
  vi.useFakeTimers();
  const ticking = new SessionRegistry({ ...deps, clock: systemClock });   // fake timers also move Date.now()
  const live = await ticking.create(); ticking.startTicks();
  live.dispatch(seeOat);
  await vi.advanceTimersByTimeAsync(TIMING.viewMs + TIMING.promptTtlAfterLeftMs + 1000);
  expect(live.state.prompt).toBeNull();
  ticking.stop();
});
it('creates a session with the profile patch, a random ID, and a random token', async () => {
  const brief = await registry.create({ detail: 'brief' });
  expect(brief.state.profile).toMatchObject({ detail: 'brief', lang: 'en' });
  expect(brief.id).not.toBe(session.id);
  expect(brief.token).not.toBe(session.token);
  expect(brief.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(await registry.get(brief.id)).toBe(brief);
  expect(registry.live()).toEqual([session, brief]);
});
it('removes a session from the memory and from the store', async () => {
  const stopped = vi.fn();
  session.onStop(stopped);
  session.dispatch(seeOat);
  await registry.remove(session.id);
  expect(stopped).toHaveBeenCalledTimes(1);
  expect(await registry.get(session.id)).toBeNull();
  expect(await store.getSession(session.id)).toBeNull();
});
it('gives the session and its cart back after a restart', async () => {
  const first = new SessionRegistry(deps);
  const shopper = await first.create();
  shopper.dispatch(seeOat);
  shopper.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  await shopper.settled();
  const second = new SessionRegistry(deps);       // the same store, as after a restart
  const again = await second.get(shopper.id);
  expect(again!.token).toBe(shopper.token);
  expect(again!.snapshot().cart.totalCents).toBe(189);
  expect(await second.get(shopper.id)).toBe(again);
  expect(await second.get('no-such-session')).toBeNull();
});
it('loads a session one time when two callers ask for it together', async () => {
  const second = new SessionRegistry(deps);
  const [a, b] = await Promise.all([second.get(session.id), second.get(session.id)]);
  expect(a).not.toBeNull();
  expect(a).toBe(b);
});
it('fails a payment that a restart cut off, and keeps the cart', async () => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  // The start of a payment makes no event, so this event is what puts the step 'paying' in the store.
  session.dispatch({ type: 'device.state', state: STREAMING });
  await session.settled();
  expect((await store.getSession(session.id))!.checkout!.step).toBe('paying');
  const again = (await new SessionRegistry(deps).get(session.id))!;
  expect(again.state.checkout).toBeNull();
  expect(again.state.phase).toBe('shopping');
  expect(again.snapshot().cart.totalCents).toBe(189);
});
