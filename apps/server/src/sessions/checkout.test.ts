import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { BARISTA, CRISPS, type Harness, KIOSK, OAT, RYE, STREAMING, harness, product } from './harness';
import { toSnapshot } from './view';

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

const costly = () => { const h = harness({ products: [product('tv', 5001)], cart: ['tv'] }); h.kiosk(); return h; };

it('asks for a fingerprint above 50 EUR, and pays only after it', () => {
  const h = costly();
  expect(h.event('checkout.offered')!.needsBiometric).toBe(true);
  h.done(); h.yes('head');
  expect(h.lines()).toEqual(['checkout.biometric']);
  expect(h.effects.at(-1)).toEqual({ type: 'biometric.request' });
  expect(payments(h)).toEqual([]);
  h.send({ type: 'biometric.result', ok: true });
  expect(h.effects).toEqual([{ type: 'payment.start', kiosk: KIOSK, totalCents: 5001 }]);
});
it('needs no fingerprint at exactly 50 EUR', () => {
  const h = harness({ products: [product('radio', 5000)], cart: ['radio'] });
  h.kiosk();
  expect(h.event('checkout.offered')!.needsBiometric).toBe(false);
  h.done(); h.yes('head');
  expect(payments(h)).toHaveLength(1);
});
it('a failed fingerprint cancels the checkout', () => {
  const h = costly(); h.done(); h.yes('head');
  h.send({ type: 'biometric.result', ok: false });
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(payments(h)).toEqual([]);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
});
it('a fingerprint result with no request starts no payment', () => {
  const h = harness({ cart: [RYE] }); h.kiosk(); h.done();
  h.send({ type: 'biometric.result', ok: true });
  expect(h.effects).toEqual([]);
});
it('the fingerprint line has a high priority, interrupts, and is no prompt', () => {
  const h = costly(); h.done(); h.yes('head');
  expect(h.speak()).toMatchObject({ priority: 'high', interrupt: true, promptId: null });
  expect(h.state).toMatchObject({ prompt: null, checkout: { step: 'biometric' }, phase: 'checkout' });
});
it('while the fingerprint check runs, no answer, no undo, no cart edit, and no product changes the checkout', () => {
  const h = costly(); h.done(); const pay = h.state.prompt!.id; h.yes('head');
  h.yes('phone', pay); expect(h.effects).toEqual([]);
  h.no('phone', pay); expect(h.effects).toEqual([]);
  h.intent('undo', 'phone'); expect(h.effects).toEqual([]);
  h.send({ type: 'cart.edit', productId: 'tv', qty: 0 }); expect(h.effects).toEqual([]);
  h.see(OAT); expect(h.effects).toEqual([]);
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'streaming' } });
  h.send({ type: 'device.state', state: { ...STREAMING, stream: 'stopped' } });
  expect(h.state.checkout).toMatchObject({ step: 'biometric' });
  h.send({ type: 'biometric.result', ok: true });
  expect(payments(h)).toEqual([{ type: 'payment.start', kiosk: KIOSK, totalCents: 5001 }]);
});
it('R19 also ends a checkout that waits for the fingerprint, and a late result starts no payment', () => {
  const h = costly(); h.done(); h.yes('head');
  h.advance(T.kioskIdleMs);
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(h.state).toMatchObject({ phase: 'shopping', checkout: null });
  h.send({ type: 'biometric.result', ok: true });
  expect(h.effects).toEqual([]);
  expect(payments(h)).toEqual([]);
});
it('a second fingerprint result starts no second payment', () => {
  const h = costly(); h.done(); h.yes('head');
  h.send({ type: 'biometric.result', ok: true });
  h.send({ type: 'biometric.result', ok: true });
  expect(payments(h)).toHaveLength(1);
});
it('the snapshot says that the pay prompt needs a fingerprint', () => {
  const h = costly();
  expect(toSnapshot('s-1', h.state, [], h.ctx).prompt).toMatchObject({ kind: 'pay', totalCents: 5001, needsBiometric: true });
  const cheap = harness({ cart: [RYE] }); cheap.kiosk();
  expect(toSnapshot('s-1', cheap.state, [], cheap.ctx).prompt).toMatchObject({ kind: 'pay', needsBiometric: false });
});
it('a cart change gives a pay prompt with the fingerprint value of the new total', () => {
  const h = harness({ products: [product('radio', 5000)], cart: ['radio'] }); h.kiosk();
  h.send({ type: 'cart.edit', productId: 'radio', qty: 2 });
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 10000, needsBiometric: true });
});
it('a stop intent ends a checkout that waits for the fingerprint', () => {
  const h = costly(); h.done(); h.yes('head');
  h.intent('stop', 'phone');
  expect(h.state).toMatchObject({ phase: 'ended', checkout: null });
});

const spot = () => { const h = harness({ cart: [RYE, OAT, CRISPS] }); h.kiosk({ spotCheck: true }); return h; };

it('asks to see one product before the pay prompt', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.kiosk({ spotCheck: true });
  expect(h.events()).toEqual(['session.state', 'checkout.spotcheck']);
  expect(h.event('checkout.spotcheck')!.product.id).toBe(RYE);   // 260 is the highest price
  expect(h.speak()!.line).toMatchObject({ key: 'spotcheck.ask', product: { id: RYE } });
  expect(h.speak()).toMatchObject({ priority: 'high', interrupt: true, promptId: null });
  expect(h.state.prompt).toBeNull();
  expect(h.state.checkout).toMatchObject({ step: 'spotcheck', spotProductId: RYE });
  h.see(RYE);
  expect(h.lines()).toEqual(['spotcheck.thanks']);
  expect(h.state.checkout).toMatchObject({ step: 'suspended', suspendedBy: null, spotProductId: null });
  expect(h.state.prompt).toBeNull();
  h.kiosk({ spotCheck: true });
  expect(h.event('checkout.offered')).toMatchObject({ totalCents: 639 });
});
it('another product does not pass the spot check', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.kiosk({ spotCheck: true });
  h.see(OAT);
  expect(h.state.checkout!.step).toBe('spotcheck');
  h.kiosk({ spotCheck: true });
  expect(h.state.prompt).toMatchObject({ kind: 'product', productId: OAT });
});
it('the first cart line wins a tie for the spot check', () => {
  const h = harness({ products: [product('a', 300), product('b', 300)], cart: [OAT, 'a', 'b'] });
  h.kiosk({ spotCheck: true });
  expect(h.event('checkout.spotcheck')!.product.id).toBe('a');
});
it('a kiosk with no spot check gives the pay prompt at once', () => {
  expect(full().state.checkout).toMatchObject({ step: 'offered', spotProductId: null });
});
it('the pay prompt after the spot check ends the prompt of another product', () => {
  const h = spot();
  h.see(OAT);
  const promptId = h.state.prompt!.id;
  h.advance(500); h.see(RYE);
  expect(h.lines()).toEqual(['spotcheck.thanks']);
  h.advance(T.viewMs); h.kiosk({ spotCheck: true });
  expect(h.events()).toEqual(['glance.cleared', 'checkout.offered']);
  expect(h.event('glance.cleared')).toMatchObject({ promptId });
});
it('makes no product prompt for the shown product while it stays in view', () => {
  const h = spot();
  h.see(RYE);
  h.advance(500); h.see(RYE);
  expect(h.effects).toEqual([]);
});
it('a shown product that the shopper just added passes the spot check', () => {
  const h = harness({ cart: [OAT] });
  h.see(RYE); h.done(); h.yes('head');
  h.advance(500); h.kiosk({ spotCheck: true });
  expect(h.event('checkout.spotcheck')!.product.id).toBe(RYE);
  h.advance(500); h.see(RYE);
  expect(h.lines()).toEqual(['spotcheck.thanks']);
});
it('R19 also ends a checkout in the spot check', () => {
  const h = spot();
  h.advance(T.kioskIdleMs);
  expect(h.events()).toEqual(['checkout.cancelled', 'session.state']);
  expect(h.lines()).toEqual(['checkout.cancelled']);
  expect(h.state).toMatchObject({ checkout: null, phase: 'shopping' });
});
it('asks for another product when the product of the spot check leaves the cart', () => {
  const h = spot();
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.spotcheck']);
  expect(h.event('checkout.spotcheck')!.product.id).toBe(CRISPS);   // 190 is now the highest price
  expect(h.lines()).toEqual(['cart.removed', 'spotcheck.ask']);
  expect(h.state.checkout).toMatchObject({ step: 'spotcheck', spotProductId: CRISPS });
});
it('keeps the product of the spot check when another cart line changes', () => {
  const h = spot();
  h.send({ type: 'cart.edit', productId: OAT, qty: 0 });
  expect(h.events()).toEqual(['cart.updated']);
  expect(h.state.checkout).toMatchObject({ step: 'spotcheck', spotProductId: RYE });
});
it('an empty cart ends a checkout in the spot check', () => {
  const h = harness({ cart: [RYE] });
  h.kiosk({ spotCheck: true });
  h.send({ type: 'cart.edit', productId: RYE, qty: 0 });
  expect(h.events()).toEqual(['cart.updated', 'checkout.cancelled', 'session.state']);
  expect(h.state).toMatchObject({ checkout: null, phase: 'shopping' });
});
it('a yes or a no during the spot check pays nothing and cancels nothing', () => {
  const h = spot();
  h.yes('phone', 'p-0001'); h.no('phone', 'p-0001');
  expect(payments(h)).toEqual([]);
  expect(h.state.checkout).toMatchObject({ step: 'spotcheck' });
});
