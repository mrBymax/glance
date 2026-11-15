import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ServerToDevice, formatKioskCode } from '@glance/shared';
import { NO_RESULT } from '../recognition/result';
import { STREAMING } from '../sessions/harness';
import type { RuntimeDeps, SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { type TestApp, type TestPhone, connectPhone, testApp, upgradeStatus } from '../testing';
import { type FrameHandler, frameLogLine } from './device';

const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
/** 2 results in a row: sight opens the prompt of the oat drink with the second one. */
const showOat = (session: { dispatch(input: RuleInputBody): void }): void => {
  session.dispatch(seeOat);
  session.dispatch(seeOat);
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const isSpeak = (m: ServerToDevice) => m.t === 'speak';

let onFrame: ReturnType<typeof vi.fn<FrameHandler>>;
let ask: ReturnType<typeof vi.fn<RuntimeDeps['ask']>>;
let t: TestApp;
let id: string;
let token: string;
let session: SessionRuntime;
let phone: TestPhone;

/** Starts an app with `env` as its settings, makes a session, and connects its phone. */
async function start(env: Record<string, string>): Promise<void> {
  onFrame = vi.fn<FrameHandler>();
  ask = vi.fn<RuntimeDeps['ask']>(async () => 'It contains gluten.');
  t = await testApp(env, { onFrame, ask });
  const res = await fetch(`${t.base}/api/sessions`, { method: 'POST' });
  ({ sessionId: id, token } = CreateSessionResponseSchema.parse(await res.json()));
  session = (await t.app.sessions.get(id))!;
  phone = await connectPhone(t, id, token);
  await phone.next((m) => m.t === 'snapshot');
}
async function stop(): Promise<void> {
  phone.close();
  await t.close();
}
/** Replaces the app of the test with one that asks for a fingerprint above 50 EUR. */
async function restartWithLimit(): Promise<void> {
  await stop();
  await start({ BIOMETRIC_ABOVE_CENTS: '5000' });
}

beforeEach(() => start({}));
afterEach(stop);

/** Resolves when the server has read each message that the phone sent before the call. */
async function serverReadAll(): Promise<void> {
  const before = phone.messages.filter((m) => m.t === 'snapshot').length;
  phone.send({ t: 'profile.set', patch: {} });
  await vi.waitFor(() => expect(phone.messages.filter((m) => m.t === 'snapshot').length).toBe(before + 1));
}

it('sends a snapshot on connect', async () => {
  expect(await phone.next((m) => m.t === 'snapshot')).toMatchObject({ session: { sessionId: id, phase: 'shopping' } });
  expect(session.connected).toBe(true);
});
it('device.state with a running stream says Camera on', async () => {
  phone.send({ t: 'device.state', state: STREAMING });
  expect(await phone.next(isSpeak)).toMatchObject({ text: 'Camera on. Hold a product up to hear its price.', url: null });
});
it('a glance prompt reaches the phone as an event and as a line', async () => {
  showOat(session);
  await phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  expect(await phone.next(isSpeak)).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001', url: null,
  });
  await phone.next((m) => m.t === 'event' && m.event.type === 'caption');
});
it('prompt.done and a nod add the product', async () => {
  showOat(session);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  expect(await phone.next((m) => m.t === 'speak' && m.text.startsWith('Added'))).toMatchObject({
    text: 'Added oat drink. Total one eighty-nine.', sound: 'added',
  });
});
it('a cart edit from the phone changes the cart', async () => {
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  phone.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 3 });
  await serverReadAll();
  expect(session.state.cart.totalCents).toBe(567);
});
it('profile.set changes the profile, and the phone gets a new snapshot', async () => {
  phone.send({ t: 'profile.set', patch: { detail: 'brief' } });
  expect(await phone.next((m) => m.t === 'snapshot' && m.session.profile.detail === 'brief')).toBeDefined();
});
it('the word add adds the product, after the prompt finished', async () => {
  showOat(session);
  phone.send({ t: 'speech.final', text: 'Add.', confidence: 0.5, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'Add.', confidence: 0.5, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.totalCents).toBe(189));
});
it('drops speech with a low confidence and speech that is no command', async () => {
  showOat(session);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.49, locale: 'en-US' });
  phone.send({ t: 'speech.final', text: 'add milk to my list', confidence: 0.9, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
});
it('speech that is no command is a question, after the microphone button or a double tap', async () => {
  showOat(session);
  phone.send({ t: 'speech.final', text: 'Does it contain nuts?', confidence: 0.9, locale: 'en-US' });
  await serverReadAll();
  expect(ask).not.toHaveBeenCalled();
  phone.send({ t: 'intent', kind: 'ask', source: 'phone' });
  expect(await phone.next((m) => m.t === 'speak' && m.text === 'Listening.')).toMatchObject({ interrupt: true, promptId: null });
  phone.send({ t: 'speech.final', text: ' Does it contain nuts? ', confidence: 0.5, locale: 'en-US' });
  expect(await phone.next((m) => m.t === 'speak' && m.text === 'It contains gluten.')).toMatchObject({ priority: 'low' });
  expect(ask).toHaveBeenCalledTimes(1);
  expect(ask.mock.calls[0]).toMatchObject(['Does it contain nuts?', { id: 'oat-drink-1l' }, 'en']);
});
it('a command word in the question window stays a command, and the window stays open', async () => {
  showOat(session);
  phone.send({ t: 'intent', kind: 'ask', source: 'phone' });
  phone.send({ t: 'speech.final', text: 'help', confidence: 0.9, locale: 'en-US' });
  await phone.next((m) => m.t === 'speak' && m.text.startsWith('Hold a product up to hear'));
  expect(ask).not.toHaveBeenCalled();
  expect(session.state.askUntil).not.toBeNull();
});
it('the word remove takes back the last add when no prompt is current', async () => {
  showOat(session);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.totalCents).toBe(189));
  expect(session.state.prompt).toBeNull();
  phone.send({ t: 'speech.final', text: 'remove', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.items).toEqual([]));
});
it('the word add never pays, and the word pay does', async () => {
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  const kiosk = await t.app.kiosks.register({ name: 'Checkout 3', store: 'Demo Market' });
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  phone.send({ t: 'prompt.done', promptId: 'p-0002' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.9, locale: 'en-US' });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next((m) => m.t === 'speak' && m.text.startsWith('Hold a product up'));   // the server read both messages
  expect(session.state.checkout!.step).toBe('offered');
  phone.send({ t: 'speech.final', text: 'pay', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.phase).toBe('paid'));
});
it('the word pay never adds a product', async () => {
  showOat(session);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'pay', confidence: 0.9, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
});
it('a total above 50 EUR is paid after a yes with no biometric.request', async () => {
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  phone.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 30 });
  const kiosk = await t.app.kiosks.register({ name: 'Checkout 3', store: 'Demo Market' });
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  const offered = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  expect(offered).toMatchObject({ event: { totalCents: 5670, needsBiometric: false } });
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  await vi.waitFor(() => expect(session.state.phase).toBe('paid'));
  expect(session.state.lastReceipt).toMatchObject({ totalCents: 5670 });
  expect(phone.messages.some((m) => m.t === 'biometric.request')).toBe(false);
});
it('with a limit of 50 EUR, a payment above it waits for the fingerprint result of the phone', async () => {
  await restartWithLimit();
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  phone.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 30 });
  const kiosk = await t.app.kiosks.register({ name: 'Checkout 3', store: 'Demo Market' });
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  const offered = await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  expect(offered).toMatchObject({ event: { totalCents: 5670, needsBiometric: true } });
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  await phone.next((m) => m.t === 'biometric.request');
  const texts = phone.messages.flatMap((m) => (m.t === 'speak' ? [m.text] : []));
  expect(texts.at(-1)).toBe('Confirm with your fingerprint on the phone.');
  // The mock payment of a test takes 10 ms, so a payment that started would be over now.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(session.state.checkout!.step).toBe('biometric');
  phone.send({ t: 'biometric.result', ok: true });
  await vi.waitFor(() => expect(session.state.phase).toBe('paid'));
  expect(session.state.lastReceipt).toMatchObject({ totalCents: 5670 });
});
it('with a limit of 50 EUR, a failed fingerprint check cancels the checkout, and the cart stays', async () => {
  await restartWithLimit();
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  session.dispatch({ type: 'cart.edit', productId: 'oat-drink-1l', qty: 30 });
  const kiosk = await t.app.kiosks.register({ name: 'Checkout 3', store: 'Demo Market' });
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  await phone.next((m) => m.t === 'event' && m.event.type === 'checkout.offered');
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  await phone.next((m) => m.t === 'biometric.request');
  phone.send({ t: 'biometric.result', ok: false });
  await phone.next((m) => m.t === 'speak' && m.text === 'Checkout cancelled. Your cart is safe.');
  expect(session.state).toMatchObject({ phase: 'shopping', checkout: null, cart: { totalCents: 5670 } });
});
it('drops kiosk.seen for a code that no kiosk has, and biometric.result with no request', async () => {
  phone.send({ t: 'kiosk.seen', text: 'GL1 K3X7' });
  phone.send({ t: 'biometric.result', ok: true });
  await serverReadAll();
  expect(session.state.kioskSeen).toBeNull();
});
it('drops text that is not JSON, an unknown message, and a broken frame, and keeps the socket open', async () => {
  phone.sendRaw('not json'); phone.sendRaw(JSON.stringify({ t: 'launch.rocket' })); phone.sendRaw(new Uint8Array([0, 0]));
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  expect(await phone.next(isSpeak)).toBeDefined();
  expect(onFrame).not.toHaveBeenCalled();
});
it('gives a good frame to the frame handler', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));
  expect(onFrame.mock.calls[0]![0]).toBe(session);
  expect(onFrame.mock.calls[0]![1].header.seq).toBe(1);
  expect([...onFrame.mock.calls[0]![1].jpeg]).toEqual([...JPEG]);
});
it('gives the view, the crop, and the source size of a frame to the frame handler', async () => {
  const header = { seq: 2, ts: 1, w: 358, h: 716, blurred: true, view: 'crop', crop: { x: 304, y: 366, w: 358, h: 716 }, source: { w: 720, h: 1280 } } as const;
  phone.sendFrame(header, JPEG);
  await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));
  expect(onFrame.mock.calls[0]![1].header).toEqual(header);
  expect(onFrame.mock.calls[0]![1].context).toBeUndefined();
});
it('gives the context image of a crop to the frame handler, apart from the crop', async () => {
  const context = new Uint8Array([0xff, 0xd8, 9, 9, 0xff, 0xd9]);
  phone.sendFrame({ seq: 3, ts: 1, w: 358, h: 716, blurred: true, view: 'crop' }, JPEG, context);
  await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));
  const frame = onFrame.mock.calls[0]![1];
  expect(frame.header.contextBytes).toBe(6);
  expect([...frame.jpeg]).toEqual([...JPEG]);
  expect([...frame.context!]).toEqual([...context]);
});
it('the log line of a frame shows the view and the size of the crop', () => {
  const header = { seq: 7, ts: 1, w: 576, h: 768, blurred: true };
  expect(frameLogLine(header, 4)).toBe('frame seq=7 w=576 h=768 blurred=true kind=frame bytes=4');
  expect(frameLogLine({ ...header, w: 358, h: 716, view: 'crop', crop: { x: 304, y: 366, w: 358, h: 716 }, source: { w: 720, h: 1280 } }, 37000))
    .toBe('frame seq=7 w=358 h=716 blurred=true kind=frame bytes=37000 view=crop crop=358x716@304,366 source=720x1280');
  expect(frameLogLine({ ...header, w: 432, h: 768, view: 'full', source: { w: 720, h: 1280 } }, 20000))
    .toBe('frame seq=7 w=432 h=768 blurred=true kind=frame bytes=20000 view=full source=720x1280');
  expect(frameLogLine({ ...header, kind: 'label', view: 'crop' }, 9)).toBe('frame seq=7 w=576 h=768 blurred=true kind=label bytes=9 view=crop');
  // `bytes` is the JPEG of the crop alone. The context image has its own count.
  expect(frameLogLine({ ...header, view: 'crop', source: { w: 720, h: 1280 }, contextBytes: 13094 }, 37000))
    .toBe('frame seq=7 w=576 h=768 blurred=true kind=frame bytes=37000 view=crop source=720x1280 context=13094');
});
it('closes the socket for a message of more than 2 MB', async () => {
  phone.sendRaw(new Uint8Array(2 * 1024 * 1024 + 1));
  await phone.closed;
  await vi.waitFor(() => expect(session.connected).toBe(false));
});
it('answers 404 to an upgrade for an unknown session or another path', async () => {
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=nope&token=x`)).toBe(404);
  expect(await upgradeStatus(`${t.wsBase}/ws/device`)).toBe(404);
  expect(await upgradeStatus(`${t.wsBase}/ws/other?session=${id}&token=${token}`)).toBe(404);
});
it('keeps the session when the phone leaves, and takes the phone back', async () => {
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  phone.close();
  await phone.closed;
  await vi.waitFor(() => expect(session.connected).toBe(false));
  const back = await connectPhone(t, id, token);
  expect(await back.next((m) => m.t === 'snapshot')).toMatchObject({ session: { cart: { totalCents: 189 } } });
  back.close();
});
it('a phone that connects again hears Back online', async () => {
  phone.send({ t: 'device.state', state: STREAMING });
  await phone.next(isSpeak);
  phone.close(); await phone.closed;
  const again = await connectPhone(t, id, token);
  expect(await again.next(isSpeak)).toMatchObject({ text: 'Back online.', priority: 'high' });
  // The line comes after the snapshot, so the phone has the cart when it speaks.
  expect(again.messages[0]!.t).toBe('snapshot');
  again.close();
});
it('the first socket of a session hears no Back online', async () => {
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next(isSpeak);
  expect(phone.messages.filter(isSpeak).map((m) => (m as { text: string }).text)).not.toContain('Back online.');
});
it('sends session.end and closes the socket when a client deletes the session', async () => {
  expect((await fetch(`${t.base}/api/sessions/${id}?token=${token}`, { method: 'DELETE' })).status).toBe(204);
  await phone.closed;
  expect(phone.messages.at(-1)).toEqual({ t: 'session.end' });
});
it('closes while a phone is connected', async () => {
  await expect(Promise.race([t.close(), new Promise((_, no) => setTimeout(no, 2000))])).resolves.toBeUndefined();
});
it('a second socket for the session takes over, and no message goes out two times', async () => {
  const second = await connectPhone(t, id, token);
  await phone.closed;
  showOat(session);
  const isPrompt = (m: ServerToDevice) => m.t === 'speak' && m.promptId === 'p-0001';
  await second.next(isPrompt);
  expect(phone.messages.filter(isPrompt)).toEqual([]);
  expect(second.messages.filter(isPrompt)).toHaveLength(1);
  expect(second.messages.filter((m) => m.t === 'event' && m.event.type === 'glance.pending')).toHaveLength(1);
  expect(phone.messages.filter((m) => m.t === 'event')).toEqual([]);
  expect(session.connected).toBe(true);
  second.close();
});
it('answers each of many refused upgrades at the same time with the status', async () => {
  // A server that closes a refused socket first can lose the answer: the client then gets a connection reset.
  const statuses = await Promise.all(Array.from({ length: 60 }, () => upgradeStatus(`${t.wsBase}/ws/device?session=nope&token=x`)));
  expect(statuses).toEqual(Array.from({ length: 60 }, () => 404));
});
it('closes while a client holds a refused upgrade open', async () => {
  const { connect } = await import('node:net');
  const client = connect({ port: Number(new URL(t.base).port), host: '127.0.0.1', allowHalfOpen: true });
  let answer = '';
  client.on('data', (chunk) => { answer += chunk.toString(); });
  client.on('error', () => undefined);
  client.write('GET /ws/other HTTP/1.1\r\nHost: test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
  await vi.waitFor(() => expect(answer).toContain('404 Not Found'));
  phone.close();
  await expect(Promise.race([t.close(), new Promise((_, no) => setTimeout(no, 2000))])).resolves.toBeUndefined();
  client.destroy();
});
