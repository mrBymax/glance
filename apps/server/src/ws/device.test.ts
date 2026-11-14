import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ServerToDevice, formatKioskCode } from '@glance/shared';
import { NO_RESULT } from '../recognition/result';
import { STREAMING } from '../sessions/harness';
import type { SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { type TestApp, type TestPhone, connectPhone, testApp, upgradeStatus } from '../testing';
import type { FrameHandler } from './device';

const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const isSpeak = (m: ServerToDevice) => m.t === 'speak';

let onFrame: ReturnType<typeof vi.fn<FrameHandler>>;
let t: TestApp;
let id: string;
let token: string;
let session: SessionRuntime;
let phone: TestPhone;

beforeEach(async () => {
  onFrame = vi.fn<FrameHandler>();
  t = await testApp({}, { onFrame });
  const res = await fetch(`${t.base}/api/sessions`, { method: 'POST' });
  ({ sessionId: id, token } = CreateSessionResponseSchema.parse(await res.json()));
  session = (await t.app.sessions.get(id))!;
  phone = await connectPhone(t, id, token);
  await phone.next((m) => m.t === 'snapshot');
});
afterEach(async () => {
  phone.close();
  await t.close();
});

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
  session.dispatch(seeOat);
  await phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  expect(await phone.next(isSpeak)).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001', url: null,
  });
  await phone.next((m) => m.t === 'event' && m.event.type === 'caption');
});
it('prompt.done and a nod add the product', async () => {
  session.dispatch(seeOat);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  expect(await phone.next((m) => m.t === 'speak' && m.text.startsWith('Added'))).toMatchObject({
    text: 'Added oat drink. Total one eighty-nine.', sound: 'added',
  });
});
it('a cart edit from the phone changes the cart', async () => {
  session.dispatch(seeOat);
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
  session.dispatch(seeOat);
  phone.send({ t: 'speech.final', text: 'Add.', confidence: 0.5, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'Add.', confidence: 0.5, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.totalCents).toBe(189));
});
it('drops speech with a low confidence and speech that is no command', async () => {
  session.dispatch(seeOat);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.49, locale: 'en-US' });
  phone.send({ t: 'speech.final', text: 'add milk to my list', confidence: 0.9, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
});
it('the word remove takes back the last add when no prompt is current', async () => {
  session.dispatch(seeOat);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'add', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.totalCents).toBe(189));
  expect(session.state.prompt).toBeNull();
  phone.send({ t: 'speech.final', text: 'remove', confidence: 0.9, locale: 'en-US' });
  await vi.waitFor(() => expect(session.state.cart.items).toEqual([]));
});
it('the word add never pays, and the word pay does', async () => {
  session.dispatch(seeOat);
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
  session.dispatch(seeOat);
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'speech.final', text: 'pay', confidence: 0.9, locale: 'en-US' });
  await serverReadAll();
  expect(session.state.cart.items).toEqual([]);
});
it('drops kiosk.seen for a code that no kiosk has, and biometric.result', async () => {
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
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  phone.close();
  await phone.closed;
  await vi.waitFor(() => expect(session.connected).toBe(false));
  const back = await connectPhone(t, id, token);
  expect(await back.next((m) => m.t === 'snapshot')).toMatchObject({ session: { cart: { totalCents: 189 } } });
  back.close();
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
  session.dispatch(seeOat);
  const isPrompt = (m: ServerToDevice) => m.t === 'speak' && m.promptId === 'p-0001';
  await second.next(isPrompt);
  expect(phone.messages.filter(isPrompt)).toEqual([]);
  expect(second.messages.filter(isPrompt)).toHaveLength(1);
  expect(second.messages.filter((m) => m.t === 'event' && m.event.type === 'glance.pending')).toHaveLength(1);
  expect(phone.messages.filter((m) => m.t === 'event')).toEqual([]);
  expect(session.connected).toBe(true);
  second.close();
});
