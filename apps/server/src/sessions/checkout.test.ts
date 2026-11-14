import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { BARISTA, CRISPS, type Harness, KIOSK, OAT, RYE, harness } from './harness';

const full = () => { const h = harness({ cart: [RYE, OAT, CRISPS] }); h.kiosk(); return h; };   // total 639, pay prompt current
const payments = (h: Harness) => h.all.filter((e) => e.type === 'payment.start');

it('R14: the first report of a kiosk code starts checkout, with no second wait on the server', () => {
  expect(full().state.phase).toBe('checkout');
});
it('R15: a kiosk code with items in the cart and no product prompt starts checkout', () => {
  const h = full();
  expect(h.events()).toEqual(['session.state', 'checkout.offered']);
  expect(h.event('checkout.offered')).toEqual({
    type: 'checkout.offered', promptId: h.state.prompt!.id, kiosk: KIOSK, totalCents: 639, itemCount: 3, needsBiometric: false,
  });
  expect(h.speak()).toMatchObject({
    line: { key: 'checkout.offer', kiosk: KIOSK, itemCount: 3, totalCents: 639 },
    priority: 'high', sound: 'found', promptId: h.state.prompt!.id,
  });
  expect(h.state.checkout).toMatchObject({ kiosk: KIOSK, step: 'offered' });
});
it('R15: with an empty cart the voice says so one time for each appearance of the code', () => {
  const h = harness();
  h.kiosk();
  expect(h.lines()).toEqual(['checkout.empty']);
  expect(h.state.phase).toBe('shopping');
  h.advance(1000); h.kiosk();
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.kiosk();
  expect(h.lines()).toEqual(['checkout.empty']);
});
it('R15: a current product prompt holds the checkout back', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.done(); h.no('head'); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('R15: a busy kiosk gets one line and no checkout', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk({ busy: true });
  expect(h.lines()).toEqual(['checkout.busy']);
  expect(h.state.phase).toBe('shopping');
  h.advance(1000); h.kiosk({ busy: true });
  expect(h.effects).toEqual([]);
});
it('R16: a nod on the finished pay prompt, with the code in view, starts the payment', () => {
  const h = full(); h.done();
  h.yes('head');
  expect(h.effects).toEqual([{ type: 'payment.start', kiosk: KIOSK, totalCents: 639 }]);
  expect(h.state.checkout!.step).toBe('paying');
});
it('R16: a nod with the code out of view does not pay', () => {
  const h = full(); h.done(); h.advance(T.viewMs);
  h.yes('head');
  expect(payments(h)).toEqual([]);
  expect(h.lines()).toEqual(['hint.lookAtCode']);
});
it('R16: a yes for a product prompt never pays', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); const card = h.state.prompt!.id;
  h.no('phone', card); h.kiosk();
  h.yes('voice', card);
  expect(payments(h)).toEqual([]);
});
it('R17: a product held up during checkout suspends it, and the pay prompt returns with the new total', () => {
  const h = full(); const first = h.state.prompt!.id;
  h.see(BARISTA);
  expect(h.events()).toEqual(['checkout.suspended', 'glance.pending']);
  expect(h.state.checkout!.step).toBe('suspended');
  h.done(); h.yes('head');
  h.kiosk();
  expect(h.state.prompt).toBeNull();
  h.advance(T.viewMs); h.kiosk();
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 868, itemCount: 4 });
  expect(h.state.prompt!.id).not.toBe(first);
  h.yes('voice', first);
  expect(payments(h)).toEqual([]);
});
it('R17: a second product during a suspended checkout gives no second suspended event', () => {
  const h = full();
  h.see(BARISTA); h.see(OAT);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.state.checkout).toMatchObject({ step: 'suspended', suspendedBy: OAT });
});
it('R17: the pay prompt replaces a product prompt whose product has left the view', () => {
  const h = full();
  h.see(BARISTA); const card = h.state.prompt!.id;
  h.advance(T.viewMs); h.kiosk();
  expect(h.events()).toEqual(['glance.cleared', 'checkout.offered']);
  expect(h.event('glance.cleared')).toEqual({ type: 'glance.cleared', promptId: card });
  expect(h.state.checkout).toMatchObject({ step: 'offered', suspendedBy: null });
  expect(h.state.prompt).toMatchObject({ kind: 'pay', kioskId: KIOSK.id });
});
it('R18: a no on the pay prompt cancels the checkout and mutes the kiosk until its code has left the view', () => {
  const h = full(); h.done();
  h.no('head');
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null });
  expect(h.state.cart.totalCents).toBe(639);
  h.advance(1000); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.advance(T.viewMs); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('R19: the checkout ends when the code was out of view for 30 seconds, and the cart stays', () => {
  const h = full();
  h.advance(T.kioskIdleMs - 1);
  expect(h.state.phase).toBe('checkout');
  h.advance(1);
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null, mutedKioskId: null });
  expect(h.state.cart.totalCents).toBe(639);
});
it('a new appearance of the code after the head window gives a new pay prompt, and the old one cannot pay', () => {
  const h = full(); h.done(); const first = h.state.prompt!.id;
  h.advance(T.viewMs); h.kiosk();
  expect(h.effects).toEqual([]);                    // a new appearance, but the head window is still open
  h.advance(T.headWindowMs); h.kiosk();
  expect(h.events()).toEqual(['checkout.offered']);
  expect(h.lines()).toEqual(['checkout.offer']);
  expect(h.state.prompt!.id).not.toBe(first);
  h.yes('voice', first);
  expect(payments(h)).toEqual([]);
  h.done(); h.yes('head');
  expect(payments(h)).toHaveLength(1);
});
it('a pay prompt that still plays, or that has no head window, is not replaced', () => {
  const playing = full();
  playing.advance(T.viewMs + T.headWindowMs); playing.kiosk();
  expect(playing.effects).toEqual([]);
  const open = harness({ profile: { headWindowMs: null }, cart: [RYE] });
  open.kiosk(); open.done();
  open.advance(T.viewMs + T.headWindowMs); open.kiosk();
  expect(open.effects).toEqual([]);
});
it('R21: silence never pays', () => {
  const away = full(); away.done();
  for (let i = 0; i < 60; i += 1) away.advance(1000);
  const looking = full(); looking.done();
  for (let i = 0; i < 60; i += 1) { looking.advance(1000); looking.kiosk(); }
  expect(payments(away)).toEqual([]);
  expect(payments(looking)).toEqual([]);
  expect(looking.state.phase).toBe('checkout');
});
it('a paid checkout gives a receipt, empties the cart, and ends the session', () => {
  const h = full(); h.done(); h.yes('head');
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  expect(h.events()).toEqual(['checkout.paid', 'cart.updated', 'session.state']);
  expect(h.event('checkout.paid')).toMatchObject({
    orderId: 'ord-1', totalCents: 639, paidAt: '2026-11-14T12:00:00.000Z', kiosk: KIOSK,
  });
  expect(h.event('checkout.paid')!.items).toHaveLength(3);
  expect(h.event('cart.updated')).toEqual({ type: 'cart.updated', cart: EMPTY_CART, change: null });
  expect(h.event('session.state')).toEqual({ type: 'session.state', phase: 'paid', cameraOn: false });
  expect(h.state).toMatchObject({ phase: 'paid', cameraOn: false, cart: EMPTY_CART, checkout: null });
  expect(h.state.lastReceipt).toMatchObject({ orderId: 'ord-1', totalCents: 639 });
  expect(h.speak()).toMatchObject({ line: { key: 'checkout.paid', totalCents: 639 }, sound: 'paid', priority: 'high' });
  expect(h.effects.at(-1)).toEqual({ type: 'session.end' });
});
it('a failed payment charges nothing and waits until the shopper looks at the code again', () => {
  const h = full(); h.done(); h.yes('head');
  h.send({ type: 'payment.result', ok: false, orderId: '', paidAt: '' });
  expect(h.events()).toEqual(['checkout.failed', 'session.state']);
  expect(h.event('checkout.failed')).toEqual({ type: 'checkout.failed', reason: 'declined' });
  expect(h.lines()).toEqual(['checkout.failed']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
  expect(h.state.cart.totalCents).toBe(639);
  h.advance(1000); h.kiosk();
  expect(h.state.phase).toBe('shopping');
  h.advance(T.viewMs); h.kiosk();
  expect(h.state.phase).toBe('checkout');
});
it('a payment result with no payment in progress changes nothing', () => {
  const h = full();
  h.send({ type: 'payment.result', ok: true, orderId: 'ord-1', paidAt: '2026-11-14T12:00:00.000Z' });
  expect(h.effects).toEqual([]);
  expect(h.state.phase).toBe('checkout');
});
it('the code of another kiosk during a checkout changes no checkout', () => {
  const h = full(); const pay = h.state.prompt!.id;
  h.advance(1000);
  h.send({ type: 'kiosk.seen', kiosk: { id: 'kiosk-2', name: 'Checkout 4', store: 'Demo Market' }, busy: false, spotCheck: false });
  expect(h.effects).toEqual([]);
  expect(h.state.checkout).toMatchObject({ kiosk: KIOSK, step: 'offered' });
  expect(h.state.prompt!.id).toBe(pay);
  expect(h.state.kioskSeen).toMatchObject({ kioskId: 'kiosk-2', at: h.now });
});
it('a payment that runs does not end after 30 seconds, and a product in view gets no prompt', () => {
  const h = full(); h.done(); h.yes('head');
  h.advance(T.kioskIdleMs);
  expect(h.state.checkout!.step).toBe('paying');
  h.see(BARISTA);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});

// Review Focus 1 and 2 of Plan 1.
it('a cart change during a pay prompt gives a new pay prompt, and the old one cannot pay', () => {
  const h = full(); h.done(); const old = h.state.prompt!.id;
  h.send({ type: 'cart.edit', productId: CRISPS, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.offered']);
  expect(h.lines()).toEqual(['cart.removed', 'checkout.offer']);
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 449, itemCount: 2 });
  expect(h.effects.filter((e) => e.type === 'speak').at(-1)).toMatchObject({ interrupt: false });
  h.yes('phone', old);
  expect(payments(h)).toEqual([]);
});
it('an undo during a pay prompt gives a new pay prompt with the new total', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); h.yes('head');
  h.advance(T.viewMs); h.kiosk(); const old = h.state.prompt!.id;
  h.intent('undo', 'phone');
  expect(h.events()).toEqual(['cart.updated', 'checkout.offered']);
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 260, itemCount: 1 });
  expect(h.state.prompt!.id).not.toBe(old);
});
it('an empty cart ends the checkout', () => {
  const h = harness({ cart: [RYE] }); h.kiosk();
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['cart.removed', 'checkout.empty']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null });
  h.advance(1000); h.kiosk();
  expect(h.effects).toEqual([]);                    // the voice said "Your cart is empty" for this appearance
});
it('a second yes while the payment runs starts no second payment and says nothing', () => {
  const h = full(); h.done(); const pay = h.state.prompt!.id;
  h.yes('head');
  h.yes('head'); expect(h.effects).toEqual([]);
  h.yes('phone', pay); expect(h.effects).toEqual([]);
  h.intent('undo', 'phone'); expect(h.effects).toEqual([]);
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 }); expect(h.effects).toEqual([]);
  expect(payments(h)).toHaveLength(1);
  expect(h.state.cart.totalCents).toBe(639);
});
it('R15: a suspended checkout ends when the cart gets empty, so an empty cart never gets a pay prompt', () => {
  const h = harness({ cart: [OAT] }); h.kiosk();
  h.see(OAT); h.done(); h.no('head');               // the add-another prompt suspends the checkout, and the no removes the unit
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated', 'checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['cart.removed']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null, prompt: null, cart: EMPTY_CART });
  h.advance(T.viewMs); h.kiosk();
  expect(h.events()).toEqual([]);
  expect(h.lines()).toEqual(['checkout.empty']);
  expect(h.state.phase).toBe('shopping');
  expect(payments(h)).toEqual([]);
});
