import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type CreateKioskResponse, CreateKioskResponseSchema, CreateSessionResponseSchema, type KioskEvent, KioskEventSchema,
  type ServerToDevice, formatKioskCode, parseKioskCode,
} from '@glance/shared';
import { EventBus, kioskTopic } from '../bus';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { systemClock } from '../clock';
import { MemoryStore } from '../db/memory';
import { KIOSK_RESULT_MS, KioskService } from '../kiosk/kiosks';
import { createPayments } from '../kiosk/payment';
import { NO_RESULT } from '../recognition/result';
import { SessionRegistry } from '../sessions/registry';
import type { SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { type TestApp, type TestPhone, connectPhone, eventReader, testApp } from '../testing';

const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
const products = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const isEvent = (type: string) => (m: ServerToDevice) => m.t === 'event' && m.event.type === type;

type Shopper = { session: SessionRuntime; phone: TestPhone };
type KioskReader = { next(): Promise<KioskEvent> };

let t: TestApp;
let abort: AbortController;
let phones: TestPhone[];

const post = (path: string, body: unknown) => fetch(`${t.base}${path}`, {
  method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

/** A session with one oat drink in the cart, and its phone. */
async function shopperWithOatDrink(): Promise<Shopper> {
  const created = CreateSessionResponseSchema.parse(await (await post('/api/sessions', {})).json());
  const session = (await t.app.sessions.get(created.sessionId))!;
  const phone = await connectPhone(t, created.sessionId, created.token);
  phones.push(phone);
  await phone.next((m) => m.t === 'snapshot');
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  expect(session.state.cart.totalCents).toBe(189);
  return { session, phone };
}

/** Each message of the kiosk stream passes the shared schema, or the reader throws. */
async function kioskReader(kiosk: CreateKioskResponse): Promise<KioskReader> {
  const res = await fetch(`${t.base}/api/kiosks/${kiosk.kioskId}/events?token=${kiosk.token}`, { signal: abort.signal });
  expect(res.status).toBe(200);
  const reader = eventReader(res);
  return { next: async () => KioskEventSchema.parse(await reader.next()) };
}

/** A shopper with one oat drink, a kiosk, and a reader on the kiosk stream. `request` goes into the kiosk request. */
async function checkoutReady(request: { failPayment?: boolean; spotCheck?: boolean } = {}): Promise<Shopper & { kiosk: CreateKioskResponse; kioskEvents: KioskReader }> {
  const kiosk = CreateKioskResponseSchema.parse(await (await post('/api/kiosks', { name: 'Checkout 3', store: 'Demo Market', ...request })).json());
  return { ...(await shopperWithOatDrink()), kiosk, kioskEvents: await kioskReader(kiosk) };
}

/** Sends the code, waits for the pay prompt, and returns its ID. */
async function seeCode(phone: TestPhone, code: string): Promise<string> {
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(code) });
  const offered = await phone.next(isEvent('checkout.offered'));
  return (offered as { event: { promptId: string } }).event.promptId;
}

beforeEach(async () => {
  t = await testApp();
  abort = new AbortController();
  phones = [];
});
afterEach(async () => {
  vi.useRealTimers();
  for (const phone of phones) phone.close();
  abort.abort();
  await t.close();
});

it('registers a kiosk with a code that makes a valid QR text', async () => {
  const res = await post('/api/kiosks', { name: 'Checkout 3', store: 'Demo Market' });
  expect(res.status).toBe(201);
  const body = CreateKioskResponseSchema.parse(await res.json());
  expect(parseKioskCode(formatKioskCode(body.code))).toBe(body.code);
  expect(body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  expect(await t.store.listKiosks()).toMatchObject([{
    _id: body.kioskId, token: body.token, code: body.code, name: 'Checkout 3', store: 'Demo Market',
    boundSessionId: null, spotCheck: false, failPayment: false,
  }]);
});
it('gives each kiosk its own ID, token, and code', async () => {
  const made: CreateKioskResponse[] = [];
  for (let i = 0; i < 20; i += 1) made.push(await (await post('/api/kiosks', { name: `Checkout ${i}`, store: 'Demo Market' })).json());
  for (const key of ['kioskId', 'token', 'code'] as const) expect(new Set(made.map((kiosk) => kiosk[key])).size).toBe(20);
});
it('answers 400 for a kiosk request with no name, and 404 for the stream of an unknown kiosk', async () => {
  expect((await post('/api/kiosks', { store: 'Demo Market' })).status).toBe(400);
  expect((await post('/api/kiosks', { name: '', store: 'Demo Market' })).status).toBe(400);
  expect((await fetch(`${t.base}/api/kiosks/nope/events`, { signal: abort.signal })).status).toBe(404);
});
it('runs the checkout from the code to the receipt', async () => {
  const { phone, session, kiosk, kioskEvents } = await checkoutReady();
  expect(await kioskEvents.next()).toMatchObject({ type: 'kiosk.state', state: 'idle', code: kiosk.code });
  phone.send({ t: 'kiosk.seen', text: `gl1 ${kiosk.code.toLowerCase()}` });   // a decoder can return lower case
  const offered = await phone.next(isEvent('checkout.offered'));
  const promptId = (offered as { event: { promptId: string } }).event.promptId;
  expect(await kioskEvents.next()).toMatchObject({ state: 'connected', totalCents: 189 });
  expect((await t.store.listKiosks())[0]!.boundSessionId).toBe(session.id);
  phone.send({ t: 'prompt.done', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  const paid = await phone.next(isEvent('checkout.paid'));
  expect(paid).toMatchObject({ event: { totalCents: 189, kiosk: { name: 'Checkout 3', store: 'Demo Market' } } });
  expect(await kioskEvents.next()).toMatchObject({ state: 'paid', receipt: { totalCents: 189 } });
  expect(await t.store.listOrders(session.id)).toMatchObject([{ method: 'demo', totalCents: 189, kioskId: kiosk.kioskId }]);
  await phone.next((m) => m.t === 'session.end');
  expect(phone.messages.filter((m) => m.t === 'speak').at(-1)).toMatchObject({
    text: 'Paid. One euro eighty-nine. Your receipt is on your phone. Camera off.', sound: 'paid',
  });
});
it('writes an order with the items, the time of the clock, and an ID that the receipt repeats', async () => {
  const { phone, session, kiosk } = await checkoutReady();
  const promptId = await seeCode(phone, kiosk.code);
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId });
  const paid = await phone.next(isEvent('checkout.paid')) as { event: { orderId: string; paidAt: string } };
  const [order] = await t.store.listOrders(session.id);
  expect(order).toMatchObject({
    _id: paid.event.orderId, sessionId: session.id, paidAt: paid.event.paidAt,
    items: [{ productId: 'oat-drink-1l', qty: 1, unitPriceCents: 189 }],
  });
  expect(order!._id).toMatch(/^ord-[0-9a-f]{8}$/);
  expect(new Date(order!.paidAt).toISOString()).toBe(order!.paidAt);
  expect(session.snapshot()).toMatchObject({ phase: 'paid', lastReceipt: { orderId: order!._id, totalCents: 189 }, cart: { items: [] } });
  await vi.waitFor(async () => expect((await t.store.listKiosks())[0]!.boundSessionId).toBeNull());
});
it('a kiosk with failPayment fails the payment and makes no order', async () => {
  const { phone, session, kiosk, kioskEvents } = await checkoutReady({ failPayment: true });
  const promptId = await seeCode(phone, kiosk.code);
  phone.send({ t: 'prompt.done', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  expect(await phone.next(isEvent('checkout.failed'))).toMatchObject({ event: { reason: 'declined' } });
  expect(await t.store.listOrders(session.id)).toEqual([]);
  const states = [await kioskEvents.next(), await kioskEvents.next(), await kioskEvents.next()].map((event) => event.state);
  expect(states).toEqual(['idle', 'connected', 'failed']);
  expect(session.state.cart.totalCents).toBe(189);
  expect(session.state.phase).toBe('shopping');
});
it('a second shopper hears that the checkout is busy', async () => {
  const first = await checkoutReady();
  first.phone.send({ t: 'kiosk.seen', text: formatKioskCode(first.kiosk.code) });
  await first.phone.next(isEvent('checkout.offered'));
  const second = await shopperWithOatDrink();
  // The phone reports a code that stays in view again and again. The first reports come less than 3 seconds after
  // the prompt line of the oat drink, so the guard drops their line, and a later report gets it.
  const reports = setInterval(() => second.phone.send({ t: 'kiosk.seen', text: formatKioskCode(first.kiosk.code) }), 250);
  try {
    expect(await second.phone.next((m) => m.t === 'speak' && m.text.startsWith('This'))).toMatchObject({ text: 'This checkout is busy.' });
  } finally {
    clearInterval(reports);
  }
  expect(second.session.state.phase).toBe('shopping');
  expect(second.phone.messages.filter((m) => m.t === 'speak' && m.text.startsWith('This'))).toHaveLength(1);
  expect(second.phone.messages.filter(isEvent('error'))).toHaveLength(1);
});
it('a text that is no code of a kiosk changes nothing', async () => {
  const { phone, session } = await checkoutReady();
  phone.send({ t: 'kiosk.seen', text: 'https://example.com' });
  phone.send({ t: 'kiosk.seen', text: 'GL1 ZZZZ' });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next((m) => m.t === 'speak');
  expect(session.state.phase).toBe('shopping');
  expect(session.state.kioskSeen).toBeNull();
});
it('the kiosk is free again after a cancelled checkout', async () => {
  const first = await checkoutReady();
  const promptId = await seeCode(first.phone, first.kiosk.code);
  first.phone.send({ t: 'intent', kind: 'no', source: 'phone', promptId });
  await first.phone.next(isEvent('checkout.cancelled'));
  const states = [await first.kioskEvents.next(), await first.kioskEvents.next(), await first.kioskEvents.next()].map((event) => event.state);
  expect(states).toEqual(['idle', 'connected', 'idle']);

  const second = await shopperWithOatDrink();
  await seeCode(second.phone, first.kiosk.code);
  expect(second.session.state.phase).toBe('checkout');
});
it('the kiosk is free again when a client deletes the session of its checkout', async () => {
  const first = await checkoutReady();
  await seeCode(first.phone, first.kiosk.code);
  expect((await fetch(`${t.base}/api/sessions/${first.session.id}?token=${first.session.token}`, { method: 'DELETE', signal: abort.signal })).status).toBe(204);
  const second = await shopperWithOatDrink();
  await seeCode(second.phone, first.kiosk.code);
  expect(second.session.state.phase).toBe('checkout');
});
it('shows the new total on the kiosk when the cart changes during the checkout', async () => {
  const { phone, kiosk, kioskEvents } = await checkoutReady();
  await seeCode(phone, kiosk.code);
  phone.send({ t: 'cart.edit', productId: 'oat-drink-1l', qty: 2 });
  const states = [await kioskEvents.next(), await kioskEvents.next(), await kioskEvents.next()];
  expect(states.map((event) => [event.state, event.totalCents])).toEqual([['idle', null], ['connected', 189], ['connected', 378]]);
});
it('shows idle again after the result time', async () => {
  vi.useFakeTimers();
  const store = new MemoryStore(products);
  const bus = new EventBus();
  const kiosks = new KioskService({ store, bus, clock: systemClock });
  const payments = createPayments({ store, clock: systemClock, kiosks, delayMs: 10 });
  const registry = new SessionRegistry({
    clock: systemClock, catalog: indexCatalog(products), store, bus, clipUrl: async () => null,
    startPayment: payments, ask: async () => '', afterStep: (session, before) => kiosks.sync(session, before),
  });
  const { kioskId, code } = await kiosks.register({ name: 'Checkout 3', store: 'Demo Market' });
  const views: KioskEvent[] = [];
  bus.subscribe(kioskTopic(kioskId), (view) => views.push(view as KioskEvent));

  const session = await registry.create();
  session.dispatch(seeOat);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  kiosks.sight(session, formatKioskCode(code));
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0002' });
  await vi.advanceTimersByTimeAsync(10);
  expect(kiosks.view(kioskId)).toMatchObject({ state: 'paid', receipt: { totalCents: 189 } });
  await vi.advanceTimersByTimeAsync(KIOSK_RESULT_MS - 1);
  expect(kiosks.view(kioskId).state).toBe('paid');
  await vi.advanceTimersByTimeAsync(1);
  expect(kiosks.view(kioskId).state).toBe('idle');
  expect(views.map((view) => view.state)).toEqual(['connected', 'paid', 'idle']);
});
it('a new checkout takes the place of the result of the last one', async () => {
  const first = await checkoutReady();
  const promptId = await seeCode(first.phone, first.kiosk.code);
  first.phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId });
  await first.phone.next(isEvent('checkout.paid'));
  expect(t.app.kiosks.view(first.kiosk.kioskId).state).toBe('paid');
  const second = await shopperWithOatDrink();
  await seeCode(second.phone, first.kiosk.code);
  expect(t.app.kiosks.view(first.kiosk.kioskId)).toMatchObject({ state: 'connected', totalCents: 189 });
});
it('keeps the kiosks of the store after a restart, with no session on them', async () => {
  const store = new MemoryStore(products);
  const first = new KioskService({ store, bus: new EventBus(), clock: systemClock });
  const made = await first.register({ name: 'Checkout 3', store: 'Demo Market', spotCheck: true });
  await store.putKiosk({ ...(await store.listKiosks())[0]!, boundSessionId: 'a-session-of-the-old-process' });

  const second = new KioskService({ store, bus: new EventBus(), clock: systemClock });
  expect(second.get(made.kioskId)).toBeNull();
  await second.load();
  expect(second.get(made.kioskId)).toMatchObject({ code: made.code, token: made.token, spotCheck: true, boundSessionId: null });
  expect(second.newest()!._id).toBe(made.kioskId);
  expect(second.view(made.kioskId).state).toBe('idle');
});
it('the fake server has the kiosk K3X7 from the start', async () => {
  await t.close();
  t = await testApp({ FAKE_RECOGNITION: '1', GEMINI_API_KEY: '' });
  const { phone } = await shopperWithOatDrink();
  phone.send({ t: 'kiosk.seen', text: 'GL1 K3X7' });
  const offered = await phone.next(isEvent('checkout.offered'));
  expect(offered).toMatchObject({ event: { kiosk: { name: 'Checkout 3', store: 'Demo Market' } } });
  expect(await t.store.listKiosks()).toHaveLength(1);
});
it('a server with real recognition has no kiosk at the start', async () => {
  expect(await t.store.listKiosks()).toEqual([]);
});
it('a second yes during the payment makes one order', async () => {
  const { phone, session, kiosk } = await checkoutReady();
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  const offered = await phone.next(isEvent('checkout.offered'));
  const promptId = (offered as { event: { promptId: string } }).event.promptId;
  phone.send({ t: 'prompt.done', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId });
  await phone.next(isEvent('checkout.paid'));
  expect(await t.store.listOrders(session.id)).toHaveLength(1);
});
it('a kiosk with spotCheck asks for one product, and gives the pay prompt after the shopper showed it', async () => {
  const { phone, session, kiosk, kioskEvents } = await checkoutReady({ spotCheck: true });
  expect(await kioskEvents.next()).toMatchObject({ state: 'idle' });
  phone.send({ t: 'kiosk.seen', text: formatKioskCode(kiosk.code) });
  expect(await phone.next(isEvent('checkout.spotcheck'))).toMatchObject({ event: { product: { id: 'oat-drink-1l' } } });
  expect(await phone.next((m) => m.t === 'speak' && m.text === 'Quick check. Show me the oat drink.')).toMatchObject({ promptId: null });
  expect(await kioskEvents.next()).toMatchObject({ state: 'spotcheck', totalCents: 189, cart: { totalCents: 189 } });
  expect(session.state.prompt).toBeNull();
  session.dispatch(seeOat);
  await phone.next((m) => m.t === 'speak' && m.text === 'Thank you.');
  expect(await kioskEvents.next()).toMatchObject({ state: 'connected', totalCents: 189 });
  const promptId = await seeCode(phone, kiosk.code);
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId });
  expect(await phone.next(isEvent('checkout.paid'))).toMatchObject({ event: { totalCents: 189 } });
});
