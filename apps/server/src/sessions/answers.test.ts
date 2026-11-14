import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { HEAD_LATE_MS, HEAD_MAX_EXTRA_MS, accepts } from './answers';
import { BARISTA, OAT, RYE, harness, product } from './harness';
import { excludeList } from './view';

/** The longest time after `prompt.done`, or after the start of a prompt with no `prompt.done`, at which the phone can send a head answer. */
const HEAD_BOUND_MS = T.headWindowMs + HEAD_MAX_EXTRA_MS + HEAD_LATE_MS;

it('R3: a yes with the ID of a replaced prompt adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); const old = h.state.prompt!.id;
  h.see(RYE); h.done();
  h.yes('voice', old);
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.yes('voice');
  expect(h.state.cart.items.map((i) => i.productId)).toEqual([RYE]);
});
it('R3: a yes with no prompt ID adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.send({ type: 'intent', kind: 'yes', source: 'phone' });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a nod counts inside the head window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, T.headWindowMs - 500);
  h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R4: a nod that the phone sends late counts, up to 21 seconds after the head window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, HEAD_BOUND_MS - 500);
  h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R4: a nod does not count 21 seconds after the head window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.hold(OAT, HEAD_BOUND_MS);
  h.yes('head');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a late nod does not count for a prompt that was replaced', () => {
  const h = harness();
  h.see(OAT); h.done(); const old = h.state.prompt!.id;
  h.hold(OAT, T.headWindowMs);
  h.see(RYE); h.done();
  h.yes('head', old);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R4: a late nod does not count for a prompt that ended', () => {
  const h = harness();
  h.see(OAT); h.done(); const old = h.state.prompt!.id;
  h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  expect(h.state.prompt).toBeNull();
  h.yes('head', old);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
// The test of 2026-11-14: recognition named the product in one frame, 8 seconds before the nod.
it('R4: a nod counts with the product out of view for 10 seconds', () => {
  const h = harness();
  h.see(OAT); h.done(); h.away(10_000);
  h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
  expect(h.lines()).toEqual(['cart.added']);
});
it('R4: a shake counts with the product out of view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.away(T.viewMs);
  h.no('head');
  expect(h.lines()).toEqual(['glance.skipped']);
});
it('R4: a nod counts with no frame for 12 seconds', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(12_000);
  h.yes('head');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R4: a nod counts while the line of a product prompt plays', () => {
  const h = harness();
  h.see(OAT); h.advance(1500);
  h.yes('head', h.state.prompt!.id);
  expect(h.state.cart.totalCents).toBe(189);
  expect(h.state.prompt).toBeNull();
});
it('R4: a nod before prompt.done counts up to 29 seconds after the start of the prompt', () => {
  const late = harness();
  late.see(OAT); const id = late.state.prompt!.id; late.hold(OAT, HEAD_BOUND_MS);
  late.yes('head', id);
  expect(late.state.cart).toEqual(EMPTY_CART);
  const inTime = harness();
  inTime.see(OAT); inTime.hold(OAT, HEAD_BOUND_MS - 500);
  inTime.yes('head', id);
  expect(inTime.state.cart.totalCents).toBe(189);
});
it('R4: a session that an older server stored, whose prompt has no start time, takes a nod before prompt.done', () => {
  const h = harness();
  h.see(OAT);
  const { startedAt: _startedAt, ...stored } = h.state.prompt!;
  h.state = { ...h.state, prompt: stored as typeof h.state.prompt };
  h.yes('head', stored.id);
  expect(h.state.cart.totalCents).toBe(189);
});
it('R10: a voice no takes back the unit that a nod added while the line played', () => {
  const h = harness();
  h.see(OAT); h.advance(1500);
  h.yes('head', h.state.prompt!.id);
  expect(h.state.lastDone).toMatchObject({ promptId: 'p-0001', kind: 'product' });
  h.no('voice', h.state.lastDone!.promptId);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R5, R6: a time with no frame changes nothing for the other sources', () => {
  for (const source of ['voice', 'touch', 'key', 'camera', 'phone', 'hud'] as const) {
    const h = harness();
    h.see(OAT); h.done(); h.advance(12000);
    h.yes(source);
    expect(h.state.cart.totalCents).toBe(189);
  }
});
it('R4: the profile can remove the time limit and can turn head gestures off', () => {
  const open = harness({ profile: { headWindowMs: null } });
  open.see(OAT); open.done(); open.hold(OAT, 20000); open.yes('head');
  expect(open.state.cart.totalCents).toBe(189);
  const off = harness({ profile: { headGestures: false } });
  off.see(OAT); off.done(); off.yes('head');
  expect(off.state.cart).toEqual(EMPTY_CART);
});
it('R5: a voice yes counts after the head window while the prompt is current', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.headWindowMs + 1000);
  h.yes('voice');
  expect(h.state.cart.totalCents).toBe(189);
});
it('R5: a voice yes does not count for a prompt that ended', () => {
  const h = harness();
  h.see(OAT); h.done(); h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  h.yes('voice');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R5: a yes from voice, touchpad, key, or camera needs a finished prompt', () => {
  for (const source of ['voice', 'touch', 'key', 'camera'] as const) {
    const h = harness();
    h.see(OAT);
    h.yes(source, h.state.prompt!.id);
    expect(h.state.cart).toEqual(EMPTY_CART);
    h.done(); h.advance(T.headWindowMs + 1000); h.yes(source);
    expect(h.state.cart.totalCents).toBe(189);
  }
});
it('R6: a phone yes names its card and needs no view and no finished prompt', () => {
  const h = harness();
  h.see(OAT); const card = h.state.prompt!.id;
  h.advance(T.viewMs + 5000);
  h.yes('phone', card);
  expect(h.state.cart.totalCents).toBe(189);
});
it('R6: a phone yes for a card that is gone adds nothing', () => {
  const h = harness();
  h.see(OAT); const card = h.state.prompt!.id;
  h.advance(T.viewMs + T.promptTtlAfterLeftMs);
  h.yes('phone', card);
  expect(h.state.cart).toEqual(EMPTY_CART);
  expect(h.effects).toEqual([]);
});
it('R7: an accepted yes adds one unit and names the product and the total', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); h.yes('head');
  expect(h.state.cart).toEqual({
    items: [
      { productId: RYE, name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 },
      { productId: OAT, name: 'Oat drink', packSize: '1 L', qty: 1, unitPriceCents: 189 },
    ],
    totalCents: 449,
  });
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated']);
  expect(h.event('cart.updated')!.change).toEqual({ kind: 'add', productId: OAT, name: 'Oat drink' });
  expect(h.speak()).toMatchObject({ line: { key: 'cart.added', totalCents: 449 }, sound: 'added', interrupt: true });
  expect(h.state.prompt).toBeNull();
});
it('R7: the cart line has the name in the language of the profile', () => {
  const h = harness({ profile: { lang: 'it' } });
  h.see(OAT); h.done(); h.yes('head');
  expect(h.state.cart.items[0]).toMatchObject({ name: 'Bevanda di avena', unitPriceCents: 189 });
  expect(h.event('cart.updated')!.change).toMatchObject({ name: 'Bevanda di avena' });
});
it('R8: an accepted no skips the product and mutes it until it has left the view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');
  expect(h.lines()).toEqual(['glance.skipped']);
  expect(h.events()).toEqual(['glance.cleared']);
  h.hold(OAT, 2000);
  expect(h.state.prompt).toBeNull();
  h.advance(T.viewMs); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT, mode: 'new' });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R9: recognition excludes a skipped product for 10 seconds, and another product can become pending', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');
  expect(excludeList(h.state, h.now + T.excludeAfterNoMs - 1)).toEqual([OAT]);
  expect(excludeList(h.state, h.now + T.excludeAfterNoMs)).toEqual([]);
  h.see(BARISTA);
  expect(h.state.prompt).toMatchObject({ productId: BARISTA, mode: 'new' });
});
it('R10: after an add the product is muted, a second yes does nothing, and a no removes the unit', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head');
  h.hold(OAT, 2000);
  expect(h.state.prompt).toBeNull();
  h.yes('head');
  expect(h.effects).toEqual([]);
  expect(h.verdict).toMatchObject({ accepted: false, reason: 'no-prompt' });
  expect(h.state.cart.totalCents).toBe(189);
  h.no('head');
  expect(h.lines()).toEqual(['cart.removed']);
  expect(h.verdict).toMatchObject({ accepted: true, reason: null });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R10: a no later than 8 seconds after the add removes nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head'); h.advance(T.undoWindowMs);
  h.no('head');
  expect(h.state.cart.totalCents).toBe(189);
  expect(h.effects).toEqual([]);
});
it('R11: a yes on the add-another prompt adds a unit, and a no removes one', () => {
  const more = harness({ cart: [OAT] });
  more.see(OAT); more.done(); more.yes('head');
  expect(more.state.cart.items[0]!.qty).toBe(2);
  expect(more.speak()!.line).toMatchObject({ key: 'cart.added', totalCents: 378 });
  const less = harness({ cart: [OAT] });
  less.see(OAT); less.done(); less.no('head');
  expect(less.state.cart).toEqual(EMPTY_CART);
  expect(less.lines()).toEqual(['cart.removed']);
});
it('R12: an undo removes the last added unit and names it', () => {
  const h = harness();
  h.see(RYE); h.done(); h.yes('head'); h.advance(T.viewMs);
  h.see(OAT); h.done(); h.yes('head'); h.advance(T.undoWindowMs);
  h.intent('undo', 'voice');
  expect(h.speak()!.line).toMatchObject({ key: 'cart.removed', product: { id: OAT }, totalCents: 260 });
  h.intent('undo', 'phone');
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.intent('undo', 'phone');
  expect(h.lines()).toEqual(['undo.nothing']);
});
it('R12: an undo after the unit left the cart by another way removes the unit before it', () => {
  const h = harness();
  h.see(RYE); h.done(); h.yes('head'); h.advance(T.viewMs);
  h.see(OAT); h.done(); h.yes('head');
  h.send({ type: 'cart.edit', productId: OAT, qty: 0 });
  h.intent('undo', 'voice');
  expect(h.speak()!.line).toMatchObject({ key: 'cart.removed', product: { id: RYE }, totalCents: 0 });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a yes with no product prompt to answer says nothing', () => {
  const ended = harness();
  ended.see(OAT); ended.done(); const old = ended.state.prompt!.id;
  ended.see(RYE); ended.done();
  ended.yes('head', old);
  expect(ended.effects).toEqual([]);
  expect(ended.verdict).toEqual({ kind: 'yes', source: 'head', promptId: old, accepted: false, reason: 'other-prompt' });
  const fresh = harness();
  fresh.yes('head', 'p-9999');
  expect(fresh.effects).toEqual([]);
  expect(fresh.verdict).toMatchObject({ accepted: false, reason: 'no-prompt' });
});
it('gives a verdict for each intent, with the reason for an answer that does not count', () => {
  const h = harness();
  h.send({ type: 'tick' });
  expect(h.verdict).toBeNull();
  h.intent('help', 'phone');
  expect(h.verdict).toEqual({ kind: 'help', source: 'phone', promptId: null, accepted: true, reason: null });
  h.see(OAT); const id = h.state.prompt!.id;
  h.send({ type: 'intent', kind: 'yes', source: 'phone' });
  expect(h.verdict).toMatchObject({ promptId: null, accepted: false, reason: 'no-prompt-id' });
  h.yes('voice', id);
  expect(h.verdict).toMatchObject({ accepted: false, reason: 'line-plays' });
  h.done(); h.hold(OAT, HEAD_BOUND_MS);
  h.yes('head');
  expect(h.verdict).toMatchObject({ accepted: false, reason: 'late' });
  h.yes('voice');
  expect(h.verdict).toEqual({ kind: 'yes', source: 'voice', promptId: id, accepted: true, reason: null });
  const off = harness({ profile: { headGestures: false } });
  off.see(OAT); off.done(); off.yes('head');
  expect(off.verdict).toMatchObject({ accepted: false, reason: 'head-off' });
});
it('R21: silence never adds', () => {
  const h = harness();
  h.see(OAT); h.done();
  for (let i = 0; i < 60; i += 1) h.advance(1000);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a cart edit sets the quantity and names the product', () => {
  const h = harness({ cart: [RYE, OAT] });
  h.send({ type: 'cart.edit', productId: OAT, qty: 0 });
  expect(h.state.cart).toEqual({
    items: [{ productId: RYE, name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 }], totalCents: 260,
  });
  expect(h.speak()!.line).toMatchObject({ key: 'cart.removed', product: { id: OAT }, totalCents: 260 });
});
it('a cart edit to a higher quantity names the product as added', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'cart.edit', productId: RYE, qty: 3 });
  expect(h.state.cart).toMatchObject({ items: [{ productId: RYE, qty: 3 }], totalCents: 780 });
  expect(h.event('cart.updated')!.change).toEqual({ kind: 'add', productId: RYE, name: 'Rye bread' });
  expect(h.speak()!.line).toMatchObject({ key: 'cart.added', totalCents: 780 });
});
it('a cart edit cannot add a product that the cart does not hold', () => {
  const h = harness();
  h.send({ type: 'cart.edit', productId: OAT, qty: 1 });
  expect(h.effects).toEqual([]);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a cart edit with a bad quantity or the same quantity changes nothing', () => {
  const h = harness({ cart: [RYE] });
  for (const qty of [-1, 1.5, 100, Number.NaN, 1]) {
    h.send({ type: 'cart.edit', productId: RYE, qty });
    expect(h.effects).toEqual([]);
  }
  expect(h.state.cart.totalCents).toBe(260);
});
it('a prompt.done for the current prompt starts its head window', () => {
  const h = harness();
  h.see(OAT);
  h.send({ type: 'prompt.done', promptId: 'p-9999' });
  expect(h.state.prompt!.doneAt).toBeNull();
  expect(h.state.lastDone).toBeNull();
  h.done();
  expect(h.state.prompt!.doneAt).toBe(h.now);
  expect(h.state.lastDone).toEqual({ promptId: 'p-0001', kind: 'product', at: h.now, hinted: false });
});
it('accepts tells if an answer counts for the current prompt', () => {
  const h = harness();
  h.see(OAT); h.done();
  const id = h.state.prompt!.id;
  expect(accepts(h.state, { source: 'head', promptId: id }, h.now)).toBe(true);
  expect(accepts(h.state, { source: 'head', promptId: id }, h.now + HEAD_BOUND_MS - 1)).toBe(true);
  expect(accepts(h.state, { source: 'head', promptId: id }, h.now + HEAD_BOUND_MS)).toBe(false);
  expect(accepts(h.state, { source: 'hud', promptId: id }, h.now + HEAD_BOUND_MS)).toBe(true);
  expect(accepts(h.state, { source: 'hud' }, h.now)).toBe(false);
  expect(accepts(h.state, { source: 'hud', promptId: 'p-9999' }, h.now)).toBe(false);
});
it('warns one time when an add crosses the budget', () => {
  const h = harness({ profile: { budgetCents: 2000 }, products: [product('big-box', 1921)], cart: ['big-box'] });
  h.see(OAT); h.done(); h.yes('head');
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated', 'budget.exceeded']);
  expect(h.event('budget.exceeded')).toEqual({ type: 'budget.exceeded', budgetCents: 2000, totalCents: 2110 });
  expect(h.speak()).toMatchObject({ line: { key: 'cart.added', totalCents: 2110, budgetCents: 2000 }, sound: 'warning' });
  h.advance(T.viewMs); h.see(RYE); h.done(); h.yes('head');
  expect(h.events()).toEqual(['glance.cleared', 'cart.updated']);
  expect(h.speak()).toMatchObject({ line: { budgetCents: null }, sound: 'added' });
});
it('gives no budget warning for a total that equals the budget, and none with no budget', () => {
  const exact = harness({ profile: { budgetCents: 2110 }, products: [product('big-box', 1921)], cart: ['big-box'] });
  exact.see(OAT); exact.done(); exact.yes('head');
  expect(exact.events()).toEqual(['glance.cleared', 'cart.updated']);
  expect(exact.speak()).toMatchObject({ line: { budgetCents: null }, sound: 'added' });
  const free = harness({ products: [product('big-box', 1921)], cart: ['big-box'] });
  free.see(OAT); free.done(); free.yes('head');
  expect(free.events()).toEqual(['glance.cleared', 'cart.updated']);
});
it('warns when a higher quantity in a cart edit crosses the budget', () => {
  const h = harness({ profile: { budgetCents: 500 }, cart: [OAT] });
  h.send({ type: 'cart.edit', productId: OAT, qty: 2 });
  expect(h.events()).toEqual(['cart.updated']);
  h.send({ type: 'cart.edit', productId: OAT, qty: 4 });
  expect(h.events()).toEqual(['cart.updated', 'budget.exceeded']);
  expect(h.event('budget.exceeded')).toEqual({ type: 'budget.exceeded', budgetCents: 500, totalCents: 756 });
  expect(h.speak()).toMatchObject({ line: { key: 'cart.added', budgetCents: 500 }, sound: 'warning' });
});
it('warns again when the total comes back under the budget and an add crosses it again', () => {
  const h = harness({ profile: { budgetCents: 300 }, cart: [OAT] });
  h.send({ type: 'cart.edit', productId: OAT, qty: 2 });
  expect(h.events()).toEqual(['cart.updated', 'budget.exceeded']);
  h.send({ type: 'cart.edit', productId: OAT, qty: 1 });
  expect(h.events()).toEqual(['cart.updated']);
  expect(h.speak()).toMatchObject({ line: { key: 'cart.removed' }, sound: 'removed' });
  h.send({ type: 'cart.edit', productId: OAT, qty: 2 });
  expect(h.events()).toEqual(['cart.updated', 'budget.exceeded']);
});
