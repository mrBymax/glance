import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type ServerEvent, type ServerToDevice, TIMING } from '@glance/shared';
import { EventBus, sessionTopic } from '../bus';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { systemClock } from '../clock';
import { MemoryStore } from '../db/memory';
import { NO_RESULT } from '../recognition/result';
import { ClipCache } from '../speech/clips';
import { createClipUrl } from '../speech/service';
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
let ask: ReturnType<typeof vi.fn<RuntimeDeps['ask']>>;
let deps: RuntimeDeps;
let logLines: string[];
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
  ask = vi.fn<RuntimeDeps['ask']>(async () => 'The data lists gluten only.');
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
    ask,
    afterStep,
    log: (line) => { logLines.push(line); },
  };
  logLines = [];
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
it('logs each intent with the verdict of the rules', () => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'voice', promptId: 'p-0001' });
  session.dispatch({ type: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  session.dispatch(help);
  expect(logLines.filter((line) => line.startsWith('intent '))).toEqual([
    `intent session=${session.id} kind=yes source=voice prompt=p-0001 accepted=false reason=line-plays`,
    `intent session=${session.id} kind=yes source=head prompt=p-0001 accepted=true reason=none`,
    `intent session=${session.id} kind=help source=phone prompt=none accepted=true reason=none`,
  ]);
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
it('does not run a stop listener that was removed', () => {
  const removed = vi.fn();
  session.onStop(removed)();
  session.stop();
  expect(removed).not.toHaveBeenCalled();
});
it('end tells the phone, closes its socket, and stops', async () => {
  session.attach(sink); session.end(); await session.settled();
  expect(sink.sent).toEqual([{ t: 'session.end' }]);
  expect(sink.closed).toBe(true);
  expect(session.connected).toBe(false);
  expect(session.stopped).toBe(true);
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
it('asks the phone for the fingerprint after the line, and starts the payment after the result', async () => {
  session.attach(sink);
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'cart.edit', productId: 'oat-drink-1l', qty: 30 });
  session.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  await session.settled();
  expect(sink.sent.slice(-2)).toMatchObject([
    { t: 'speak', text: 'Over fifty euros. Confirm with your fingerprint on the phone.', promptId: null },
    { t: 'biometric.request' },
  ]);
  expect(startPayment).not.toHaveBeenCalled();
  session.dispatch({ type: 'biometric.result', ok: true });
  expect(startPayment).toHaveBeenCalledWith(session, KIOSK, 5670);
});
const askOat = (): void => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'ask', source: 'phone' });
  session.dispatch({ type: 'question', text: 'Does it contain nuts?' });
};
const spoken = (): string[] => sink.sent.flatMap((m) => (m.t === 'speak' ? [m.text] : []));

it('asks about the product in the language of the profile, and speaks the answer', async () => {
  session.attach(sink);
  askOat();
  expect(ask).toHaveBeenCalledWith('Does it contain nuts?', deps.catalog.get('oat-drink-1l'), 'en');
  await vi.waitFor(() => expect(spoken()).toContain('The data lists gluten only.'));
  expect(sink.sent.at(-1)).toMatchObject({ t: 'speak', priority: 'low', interrupt: false, promptId: null });
});
it('says that it could not answer when the call fails', async () => {
  ask.mockRejectedValueOnce(new Error('no service'));
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  session.attach(sink);
  askOat();
  await vi.waitFor(() => expect(spoken()).toContain('I could not answer that.'));
  expect(error).toHaveBeenCalledTimes(1);
  error.mockRestore();
});
it('says that it could not answer when the call takes more than 4 seconds, and drops the late answer', async () => {
  vi.useFakeTimers();
  let finish: (text: string) => void = () => undefined;
  ask.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  session.attach(sink);
  askOat();
  await vi.advanceTimersByTimeAsync(3999);
  expect(spoken()).not.toContain('I could not answer that.');
  await vi.advanceTimersByTimeAsync(1);
  await session.settled();
  expect(spoken()).toContain('I could not answer that.');
  finish('Late.');
  await vi.advanceTimersByTimeAsync(0);
  await session.settled();
  expect(spoken()).not.toContain('Late.');
});
it('drops an answer that arrives after the session stopped', async () => {
  let finish: (text: string) => void = () => undefined;
  ask.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  session.attach(sink);
  askOat();
  session.stop();
  finish('Late.');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await session.settled();
  expect(spoken()).not.toContain('Late.');
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
it('ends a checkout that a restart cut off, so the kiosk is free and the shopper starts again at the code', async () => {
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  await session.settled();
  expect((await store.getSession(session.id))!.checkout!.step).toBe('offered');
  const again = (await new SessionRegistry(deps).get(session.id))!;
  expect(again.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null });
  expect(again.snapshot()).toMatchObject({ kiosk: null, prompt: null, cart: { totalCents: 189 } });
  // The pay prompt of the old process cannot pay.
  again.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  expect(startPayment).not.toHaveBeenCalled();
  // The code starts a new checkout with a new prompt.
  again.dispatch({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  expect(again.state.checkout).toMatchObject({ step: 'offered' });
  expect(again.state.prompt!.id).toBe('p-0003');
});

it('logs each line that the shopper heard, with its key, its first 80 characters, and its prompt', async () => {
  session.attach(sink);
  session.dispatch(seeOat);
  session.dispatch(help);
  await session.settled();
  const spoken = logLines.filter((line) => line.startsWith('speak '));
  expect(spoken).toHaveLength(2);
  expect(spoken[0]).toBe(`speak session=${session.id} key=glance.new text=${glanceText} prompt=p-0001`);
  const helpText = (sink.sent[1] as { text: string }).text;
  expect(helpText.length).toBeGreaterThan(80);
  expect(spoken[1]).toBe(`speak session=${session.id} key=info.help text=${helpText.slice(0, 80)} prompt=none`);
});
it('logs for each product prompt the time from the frame to the result, of the product read, and of the clip', async () => {
  session.attach(sink);
  clipDelays = [40];
  session.dispatch(seeOat, { frameToResultMs: 1400, resolveMs: 12 });
  session.dispatch(help);
  await session.settled();
  const timing = logLines.filter((line) => line.startsWith('glance timing '));
  expect(timing).toHaveLength(1);
  const match = new RegExp(`^glance timing session=${session.id} product=oat-drink-1l frameToResultMs=1400 resolveMs=12 clipMs=(\\d+)$`).exec(timing[0]!);
  expect(match).not.toBeNull();
  expect(Number(match![1])).toBeGreaterThanOrEqual(35);
  // The line follows the speak line of its prompt.
  expect(logLines[logLines.indexOf(timing[0]!) - 1]).toMatch(/^speak .* prompt=p-0001$/);
});
const addedText = 'Added oat drink. Total one eighty-nine.';
/** The real clip function with a cache in a new directory. `synthesize` stands for the speech service. */
function clipsWith(synthesize: (text: string, voiceId: string) => Promise<Uint8Array>): { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'glance-answer-clips-'));
  deps.clipUrl = createClipUrl({
    fake: false, cache: new ClipCache(dir, store), synthesize, voiceId: { en: 'voice-en', it: null }, publicBaseUrl: 'http://localhost:8080',
  });
  return { dir };
}
it('asks for the clips of the answer lines when a product prompt opens, and the answer line takes its clip from the cache', async () => {
  const synthesize = vi.fn(async (_text: string, _voiceId: string) => new Uint8Array([1]));
  const { dir } = clipsWith(synthesize);
  try {
    session.attach(sink); session.dispatch(seeOat); await session.settled();
    await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3));
    expect(synthesize.mock.calls.map((call) => call[0]).sort()).toEqual([addedText, glanceText, 'Skipped.'].sort());

    session.dispatch({ type: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' }); await session.settled();
    expect(synthesize).toHaveBeenCalledTimes(3);
    expect(sink.sent.at(-1)).toMatchObject({ t: 'speak', text: addedText, url: expect.stringMatching(/\.mp3$/) });
    expect(logLines).toContainEqual(expect.stringMatching(new RegExp(`^answer timing session=${session.id} key=cart.added clipMs=\\d+$`)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('sends the prompt line while the clip of an answer line is not made yet', async () => {
  const { dir } = clipsWith(async (text) => (text === addedText ? new Promise<Uint8Array>(() => undefined) : new Uint8Array([1])));
  try {
    session.attach(sink); session.dispatch(seeOat); await session.settled();
    expect(sink.sent).toMatchObject([{ t: 'speak', text: glanceText, promptId: 'p-0001' }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('asks for the clip of the remove line when the prompt is for a product in the cart', async () => {
  const texts: string[] = [];
  deps.clipUrl = async (text) => { texts.push(text); return null; };
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  time += TIMING.viewMs;
  session.dispatch(seeOat);
  await session.settled();
  expect(texts).toContain('Added oat drink. Total three seventy-eight.');
  expect(texts).toContain('Removed oat drink. Total zero euros.');
  // The two answers ran on a copy of the state.
  expect(session.state.cart.totalCents).toBe(189);
  expect(session.state.prompt).toMatchObject({ id: 'p-0002', mode: 'inCart' });
});
it('a product prompt of an input with no measured times logs none for them', async () => {
  session.attach(sink);
  session.dispatch(seeOat);
  await session.settled();
  expect(logLines[1]).toMatch(new RegExp(`^glance timing session=${session.id} product=oat-drink-1l frameToResultMs=none resolveMs=none clipMs=\\d+$`));
});
it('logs each line that the guard dropped, with the reason, and sends the phone nothing for it', async () => {
  session.attach(sink);
  session.dispatch(seeOat);
  time += 1000;
  session.dispatch({ type: 'recognition.slow' });
  await session.settled();
  expect(logLines).toEqual([
    `speak dropped session=${session.id} key=recognition.slow reason=gap`,
    `speak session=${session.id} key=glance.new text=${glanceText} prompt=p-0001`,
    expect.stringMatching(/^glance timing /),
  ]);
  expect(sink.sent.filter((message) => message.t === 'speak')).toHaveLength(1);
  expect(busEvents.filter((event) => event.type === 'caption')).toHaveLength(1);
});
