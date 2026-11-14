import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { NO_RESULT, RecognitionResultSchema } from '../recognition/result';
import { BARISTA, CRISPS, OAT, RYE, harness } from './harness';
import { LINE_DEFAULTS, say } from './say';
import { step } from './step';
import { excludeList, inView } from './view';

it('R1: a recognized product becomes the pending product and gets a glance prompt', () => {
  const h = harness();
  h.see(OAT);
  expect(h.state.prompt).toEqual({ id: 'p-0001', kind: 'product', mode: 'new', productId: OAT, doneAt: null });
  expect(h.events()).toEqual(['glance.pending']);
  expect(h.event('glance.pending')).toEqual({
    type: 'glance.pending', promptId: 'p-0001', kind: 'new',
    product: { id: OAT, name: 'Oat drink', packSize: '1 L', priceCents: 189 }, warnings: [], qtyInCart: 0,
  });
  expect(h.speak()).toMatchObject({
    line: { key: 'glance.new', hint: true }, promptId: 'p-0001', priority: 'normal', interrupt: true, sound: null,
  });
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('R1: results inside the view time give one prompt', () => {
  const h = harness();
  h.hold(OAT, 2500);
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
});
it('R1: a product that comes back after it left the view gets a new prompt', () => {
  const h = harness();
  h.see(OAT); h.advance(T.viewMs); h.see(OAT);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.state.prompt!.id).toBe('p-0002');
});
it('R2: a new product in view replaces the pending product', () => {
  const h = harness();
  h.see(OAT); h.see(RYE);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.event('glance.cleared')).toEqual({ type: 'glance.cleared', promptId: 'p-0001' });
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R5: a product prompt ends when its product left the view for 15 seconds', () => {
  const h = harness();
  h.see(OAT);
  h.advance(T.viewMs + T.promptTtlAfterLeftMs - 1);
  expect(h.state.prompt).not.toBeNull();
  h.advance(1);
  expect(h.state.prompt).toBeNull();
  expect(h.events()).toEqual(['glance.cleared']);
});
it('R11: a product in the cart that comes into view gets the add-another prompt', () => {
  const h = harness({ cart: [OAT] });
  h.see(OAT);
  expect(h.state.prompt).toMatchObject({ kind: 'product', mode: 'inCart', productId: OAT });
  expect(h.event('glance.pending')).toMatchObject({ kind: 'inCart', qtyInCart: 1 });
  expect(h.speak()!.line).toMatchObject({ key: 'glance.inCart', qty: 1 });
});
it('R13: the unknown line plays one time for each appearance', () => {
  const h = harness();
  h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
  expect(h.events()).toEqual(['glance.unknown']);
  h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
});
it('gives an aim hint at most one time each 5 seconds', () => {
  const h = harness();
  h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.events()).toEqual(['glance.hint']);
  expect(h.speak()!.line).toEqual({ key: 'glance.partial', aimHint: 'left' });
  h.advance(T.aimHintEveryMs - 1); h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.effects).toEqual([]);
  h.advance(1); h.result({ status: 'unsure', aimHint: 'up' });
  expect(h.lines()).toEqual(['glance.partial']);
});
it('adds the yes hint to the first three glance prompts only', () => {
  const h = harness();
  const hints = [OAT, RYE, BARISTA, CRISPS].map((id) => { h.see(id); return (h.speak()!.line as { hint: boolean }).hint; });
  expect(hints).toEqual([true, true, true, false]);
});
it('ignores a result while the camera rests', () => {
  const h = harness();
  h.state = { ...h.state, phase: 'resting' };
  h.see(OAT);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});
it('does not change the state that it gets', () => {
  const h = harness();
  const before = structuredClone(h.state);
  const result = { ...NO_RESULT, status: 'identified' as const, productId: OAT };
  step(h.state, { type: 'recognition', now: h.now, result, still: false }, h.ctx);
  expect(h.state).toEqual(before);
});

it('asks to turn the product for an ambiguous result, and says nothing for an unsure result with no aim hint', () => {
  const h = harness();
  h.result({ status: 'unsure' });
  expect(h.effects).toEqual([]);
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.event('glance.hint')).toEqual({ type: 'glance.hint', aimHint: 'turn' });
  expect(h.speak()!.line).toEqual({ key: 'glance.partial', aimHint: 'turn' });
});
it('says nothing for an unknown result while the product of the current prompt is in view', () => {
  const h = harness();
  h.see(OAT); h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  expect(h.state.unknownAt).toBeNull();
});
it('makes no prompt for a product ID that the catalog does not hold', () => {
  const h = harness();
  h.see('no-such-product');
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});
it('keeps the last spoken line for the repeat intent', () => {
  const h = harness();
  h.see(OAT);
  expect(h.state.lastSpeak).toEqual(h.speak());
  h.advance(500);
  expect(h.state.lastSpeak).toMatchObject({ line: { key: 'glance.new' } });
});
it('holds the defaults of the spoken lines', () => {
  expect(LINE_DEFAULTS['checkout.offer']).toEqual({ priority: 'high', sound: 'found', interrupt: true });
  expect(LINE_DEFAULTS['info.total']).toEqual({ priority: 'low', sound: null, interrupt: false });
  expect(say({ key: 'hint.lookAtCode' })).toEqual({
    type: 'speak', line: { key: 'hint.lookAtCode' }, priority: 'high', sound: null, interrupt: false, promptId: null,
  });
  expect(say({ key: 'glance.skipped' }, { interrupt: false, promptId: 'p-0001' })).toMatchObject({ interrupt: false, promptId: 'p-0001' });
});
it('tells when a target is in view', () => {
  expect(inView(undefined, 5000)).toBe(false);
  expect(inView(5000, 5000 + T.viewMs - 1)).toBe(true);
  expect(inView(5000, 5000 + T.viewMs)).toBe(false);
  expect(excludeList(harness().state, 0)).toEqual([]);
});
it('checks a recognition result with its schema', () => {
  expect(RecognitionResultSchema.parse(NO_RESULT)).toEqual(NO_RESULT);
  expect(RecognitionResultSchema.safeParse({ ...NO_RESULT, confidence: 2 }).success).toBe(false);
});
