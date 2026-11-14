import { expect, it } from 'vitest';
import { DEFAULT_PROFILE, SessionSnapshotSchema, TIMING as T } from '@glance/shared';
import { CANNOT_STREAM_BATTERY, CANNOT_STREAM_THERMAL, cannotStream } from './general';
import { CRISPS, KIOSK, OAT, RYE, STREAMING, harness, product } from './harness';
import type { Line } from './types';
import { toSnapshot } from './view';

it('says Camera on when the stream starts', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.event('session.state')).toEqual({ type: 'session.state', phase: 'shopping', cameraOn: true });
  expect(h.lines()).toEqual(['session.start']);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 79 } });
  expect(h.effects).toEqual([]);
  expect(h.state.device).toEqual({ ...STREAMING, battery: 79 });
});
it('a stop intent ends the session with Camera off', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.intent('stop', 'phone');
  expect(h.state).toMatchObject({ phase: 'ended', cameraOn: false });
  expect(h.event('session.state')).toEqual({ type: 'session.state', phase: 'ended', cameraOn: false });
  expect(h.lines()).toEqual(['device.cameraOff']);
  expect(h.effects.at(-1)).toEqual({ type: 'session.end' });
  h.see(OAT);
  expect(h.effects).toEqual([]);
});
it('a stop intent ends a current prompt and an open checkout', () => {
  const glance = harness();
  glance.see(OAT);
  glance.intent('stop', 'voice');
  expect(glance.events()).toEqual(['glance.cleared', 'session.state']);
  expect(glance.state.prompt).toBeNull();
  const checkout = harness({ cart: [RYE] });
  checkout.kiosk();
  checkout.intent('stop', 'phone');
  expect(checkout.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(checkout.state).toMatchObject({ phase: 'ended', checkout: null, prompt: null });
  expect(checkout.state.cart.totalCents).toBe(260);
});
it('a stop intent has no effect while the payment runs', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk(); h.done(); h.yes('head');
  h.intent('stop', 'phone');
  expect(h.effects).toEqual([]);
  expect(h.state.checkout!.step).toBe('paying');
});
it('R22: after 3 minutes with no product and no kiosk in view the camera rests, and the cart stays', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.see(OAT);
  h.advance(T.restAfterIdleMs - 1);
  expect(h.state.phase).toBe('shopping');
  h.advance(1);
  expect(h.state).toMatchObject({ phase: 'resting', cameraOn: false });
  expect(h.events()).toEqual(['session.state']);
  expect(h.lines()).toEqual(['session.rest']);
  expect(h.effects.at(-1)).toEqual({ type: 'session.rest' });
  expect(h.state.cart.totalCents).toBe(260);
});
it('R22: the session shops again when the phone restarts the camera', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.advance(T.restAfterIdleMs);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped' } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: STREAMING });
  expect(h.state).toMatchObject({ phase: 'shopping', cameraOn: true });
  expect(h.lines()).toEqual(['session.start']);
});
it('R22: the camera does not rest while it is off', () => {
  const h = harness();
  h.advance(T.restAfterIdleMs);
  expect(h.effects).toEqual([]);
  expect(h.state.phase).toBe('shopping');
});
it('R23: the cart by voice speaks at most five lines', () => {
  const six = [1, 2, 3, 4, 5, 6].map((n) => product(`item-${n}`, 100));
  const h = harness({ products: six, cart: six.map((p) => p.id) });
  h.intent('cart', 'voice');
  const line = h.speak()!.line as Extract<Line, { key: 'info.cart' }>;
  expect(line.items.map((i) => i.product.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
  expect(line).toMatchObject({ more: true, totalCents: 600 });
});
it('R23: a cart of five lines or fewer has no more on the phone', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.intent('cart', 'voice');
  expect(h.speak()).toMatchObject({ line: { key: 'info.cart', more: false, totalCents: 449 }, priority: 'low' });
  const empty = harness();
  empty.intent('cart', 'voice');
  expect(empty.lines()).toEqual(['checkout.empty']);
});
it('R24: when the glasses cannot stream, an open checkout ends and the cart stays', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.send({ type: 'device.state', state: STREAMING });
  h.kiosk();
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', battery: 3 } });
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['device.regularCheckout']);
  expect(h.state).toMatchObject({ phase: 'shopping', cameraOn: false, checkout: null });
  expect(h.state.cart.totalCents).toBe(639);
});
it('a stop by the device for another reason says Camera off', () => {
  const h = harness();
  h.send({ type: 'device.state', state: STREAMING });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped', hingeOpen: false } });
  expect(h.lines()).toEqual(['device.cameraOff']);
  expect(h.event('session.state')).toEqual({ type: 'session.state', phase: 'shopping', cameraOn: false });
  expect(h.state.cameraOn).toBe(false);
});
it('a stream that stops while the payment runs keeps the payment', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.kiosk(); h.done(); h.yes('head');
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped' } });
  expect(h.events()).toEqual(['session.state']);
  expect(h.state.checkout!.step).toBe('paying');
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  expect(h.state.phase).toBe('paid');
});
it('tells from the battery and the thermal level that the glasses cannot stream', () => {
  expect(cannotStream(STREAMING)).toBe(false);
  expect(cannotStream({ ...STREAMING, battery: CANNOT_STREAM_BATTERY })).toBe(true);
  expect(cannotStream({ ...STREAMING, battery: CANNOT_STREAM_BATTERY + 1 })).toBe(false);
  expect(cannotStream({ ...STREAMING, thermal: CANNOT_STREAM_THERMAL })).toBe(true);
  expect(cannotStream({ ...STREAMING, thermal: CANNOT_STREAM_THERMAL - 1 })).toBe(false);
  expect(cannotStream({ ...STREAMING, battery: null, thermal: null })).toBe(false);
  expect(cannotStream({ ...STREAMING, link: 'disconnected', battery: 0 })).toBe(false);
});
it('repeats the last line and opens the head window again for a current prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, T.headWindowMs);
  h.intent('repeat', 'voice');
  expect(h.speak()).toMatchObject({ line: { key: 'glance.new' }, promptId: 'p-0001' });
  h.done(); h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('repeats the line of a prompt that ended with no prompt ID, and says nothing with no last line', () => {
  const h = harness();
  h.intent('repeat', 'voice');
  expect(h.effects).toEqual([]);
  h.see(OAT); h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  h.intent('repeat', 'voice');
  expect(h.speak()).toMatchObject({ line: { key: 'glance.new' }, promptId: null });
});
it('speaks the total, and says so for an empty cart', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.intent('total', 'voice');
  expect(h.speak()!.line).toEqual({ key: 'info.total', itemCount: 2, totalCents: 449 });
  const empty = harness();
  empty.intent('total', 'voice');
  expect(empty.lines()).toEqual(['checkout.empty']);
});
it('speaks the help line', () => {
  const h = harness();
  h.intent('help', 'voice');
  expect(h.lines()).toEqual(['info.help']);
});
it('merges a profile patch', () => {
  const h = harness();
  h.send({ type: 'profile.set', patch: { detail: 'brief' } });
  expect(h.state.profile).toEqual({ ...DEFAULT_PROFILE, detail: 'brief' });
  expect(DEFAULT_PROFILE.detail).toBe('standard');
});
it('after the payment, the session takes only the device state and a profile patch', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.kiosk(); h.done(); h.yes('head');
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  h.see(OAT); expect(h.effects).toEqual([]);
  h.kiosk(); expect(h.effects).toEqual([]);
  h.intent('total', 'voice'); expect(h.effects).toEqual([]);
  h.intent('stop', 'phone'); expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped' } }); expect(h.effects).toEqual([]);
  expect(h.state.device!.stream).toBe('stopped');
  h.send({ type: 'device.state', state: STREAMING }); expect(h.effects).toEqual([]);
  h.send({ type: 'profile.set', patch: { haptics: false } });
  expect(h.state).toMatchObject({ phase: 'paid', cameraOn: false, profile: { haptics: false } });
});
it('makes a snapshot that passes the shared schema', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT);
  const snapshot = toSnapshot('s1', h.state, [], h.ctx);
  expect(SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  expect(snapshot.prompt).toEqual({
    promptId: 'p-0001', kind: 'product', mode: 'new',
    product: { id: OAT, name: 'Oat drink', packSize: '1 L', priceCents: 189 }, warnings: [], qtyInCart: 0,
  });
  expect(snapshot).toMatchObject({ sessionId: 's1', phase: 'shopping', kiosk: null, lastReceipt: null, captions: [] });
});
it('makes a snapshot with the pay prompt, the kiosk, and the last 20 captions', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.kiosk();
  const captions = Array.from({ length: 25 }, (_, n) => ({ id: `c-${n}`, text: 'Camera on.', lang: 'en' as const, priority: 'normal' as const, url: null }));
  const snapshot = toSnapshot('s1', h.state, captions, h.ctx);
  expect(SessionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  expect(snapshot.prompt).toEqual({
    promptId: h.state.prompt!.id, kind: 'pay', kiosk: KIOSK, totalCents: 449, itemCount: 2, needsBiometric: false,
  });
  expect(snapshot).toMatchObject({ phase: 'checkout', kiosk: KIOSK });
  expect(snapshot.captions.map((c) => c.id)).toEqual(captions.slice(5).map((c) => c.id));
});
it('a language change writes the cart names again', () => {
  const h = harness({ cart: [OAT] });
  h.send({ type: 'profile.set', patch: { lang: 'it' } });
  expect(h.state.cart.items[0]!.name).toBe('Bevanda di avena');
  expect(h.event('cart.updated')).toMatchObject({ change: null });
});
it('a language change keeps the quantities and the total, and a product with no Italian name keeps its English name', () => {
  const h = harness({ cart: [OAT, RYE] });
  h.send({ type: 'cart.edit', productId: OAT, qty: 3 });
  h.send({ type: 'profile.set', patch: { lang: 'it' } });
  expect(h.state.cart.items.map((item) => [item.name, item.qty])).toEqual([['Bevanda di avena', 3], ['Rye bread', 1]]);
  expect(h.state.cart.totalCents).toBe(3 * 189 + 260);
  expect(h.event('cart.updated')!.cart).toEqual(h.state.cart);
  h.send({ type: 'profile.set', patch: { lang: 'en' } });
  expect(h.state.cart.items[0]!.name).toBe('Oat drink');
});
it('a profile patch with the same language, or with no language, gives no cart event', () => {
  const h = harness({ cart: [OAT] });
  h.send({ type: 'profile.set', patch: { lang: 'en' } });
  expect(h.effects).toEqual([]);
  h.send({ type: 'profile.set', patch: { detail: 'brief' } });
  expect(h.effects).toEqual([]);
  const empty = harness();
  empty.send({ type: 'profile.set', patch: { lang: 'it' } });
  expect(empty.effects).toEqual([]);
});
it('after a language change the next product gets its Italian name in the cart and in the prompt', () => {
  const h = harness({ profile: { lang: 'it' } });
  h.see(OAT);
  expect(h.event('glance.pending')!.product.name).toBe('Bevanda di avena');
  h.done(); h.yes('head');
  expect(h.state.cart.items[0]!.name).toBe('Bevanda di avena');
});
