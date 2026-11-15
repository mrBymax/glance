import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { NO_RESULT, type RecognitionResult, RecognitionResultSchema } from '../recognition/result';
import { STILL_ANSWER_MS } from './code';
import { ALIKE_WITHIN_MS, GO_BACK_AFTER_MS, OPEN_WITHIN_MS, SWITCH_WITHIN_MS } from './glance';
import { SAME_TEXT_MS, UNSOLICITED_GAP_MS } from './guard';
import { BARISTA, CRISPS, type Harness, KIOSK, OAT, RYE, harness } from './harness';
import { LINE_DEFAULTS, say } from './say';
import { step } from './step';
import type { SpeakEffect } from './types';
import { excludeList, inView } from './view';

it('R1: a recognized product becomes the pending product and gets a glance prompt', () => {
  const h = harness();
  h.show(OAT);
  expect(h.state.prompt).toEqual({ id: 'p-0001', kind: 'product', mode: 'new', productId: OAT, startedAt: h.now, doneAt: null });
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
it('R1: a product that comes back after it left the view gets a new prompt when the head window of its prompt is over', () => {
  const h = harness();
  h.show(OAT); h.done();
  h.advance(T.headWindowMs - 1); h.see(OAT);
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.see(OAT);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.state.prompt!.id).toBe('p-0002');
});
it('R1: with no prompt.done, the head window counts from the start of the prompt', () => {
  const h = harness();
  h.show(OAT);
  h.advance(T.headWindowMs - 1); h.see(OAT);
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.see(OAT);
  expect(h.state.prompt!.id).toBe('p-0002');
});
it('R1: the session of 2026-11-14: a still stopped the frames for 4.7 seconds, and the prompt of the held product stays for the nod', () => {
  const h = harness();
  // Server times 475.957 to 482.407 of the log: results 492 and 493, the prompt p-0003, result 497, the head answer.
  h.show(OAT);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.advance(4679); h.see(OAT);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.advance(1771); h.yes('head', 'p-0001');
  expect(h.verdict).toMatchObject({ accepted: true });
  expect(h.state.cart.items.map((item) => item.productId)).toEqual([OAT]);
});
it('R1: a profile with the head gestures off gets the new prompt when the product comes back', () => {
  const h = harness({ profile: { headGestures: false } });
  h.show(OAT); h.advance(T.viewMs); h.see(OAT);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
});
it('R1: a profile with no end of the head window keeps the prompt until R5', () => {
  const h = harness({ profile: { headWindowMs: null } });
  h.show(OAT); h.done();
  h.advance(T.viewMs + T.promptTtlAfterLeftMs - 1); h.see(OAT);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt!.id).toBe('p-0001');
});
it('R1: one result by sight opens no prompt, and the second result in a row for the product opens it', () => {
  const h = harness();
  h.see(OAT);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
  expect(h.state.seen[OAT]).toBeUndefined();
  h.advance(150); h.see(OAT);
  expect(h.lines()).toEqual(['glance.new']);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('R1: a result between the 2 results starts the count again, but not a look-alike result with the product', () => {
  const others = [
    { status: 'none' }, { status: 'unsure' }, { status: 'unknown' }, { status: 'identified', productId: RYE },
    { status: 'ambiguous', candidates: [RYE, CRISPS] },
  ] satisfies Partial<RecognitionResult>[];
  for (const between of others) {
    const h = harness();
    h.see(OAT);
    h.advance(150); h.result(between);
    h.advance(150); h.see(OAT);
    expect(h.state.prompt).toBeNull();
    h.advance(150); h.see(OAT);
    expect(h.state.prompt).toMatchObject({ productId: OAT });
  }
  const h = harness();
  h.see(OAT);
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(150); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT });
});
it('R1: the 2 results must come inside 1.5 seconds', () => {
  const h = harness();
  h.see(OAT);
  h.at(OPEN_WITHIN_MS + 1); h.see(OAT);
  expect(h.state.prompt).toBeNull();
  h.advance(OPEN_WITHIN_MS); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('R1: single results for one product among results with no name open no prompt', () => {
  const h = harness();
  // The test of 2026-11-14: 4 blurred frames got the name of one can, 3 to 4 seconds apart. Each got a prompt.
  for (const before of ['ambiguous', 'unsure', 'none', 'unsure'] as const) {
    h.advance(300); h.result(before === 'ambiguous' ? { status: before, candidates: [RYE, CRISPS] } : { status: before });
    h.advance(300); h.see(OAT);
    h.advance(300); h.result({ status: 'none' });
    h.away(2500);
  }
  expect(h.state.prompt).toBeNull();
  expect(h.all.filter((e) => e.type === 'speak' && e.line.key === 'glance.new')).toEqual([]);
});
it('R1: a barcode, and the still of the second look, open a prompt with one result', () => {
  const code = harness();
  code.barcode({ kind: 'product', productId: OAT });
  expect(code.state.prompt).toMatchObject({ productId: OAT });

  const second = harness();
  second.send({ type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: OAT, confidence: 1 }, still: true });
  expect(second.state.prompt).toMatchObject({ productId: OAT });
});
it('R1: one result by sight does not hold back the still for a product that sight cannot name', () => {
  const h = harness();
  h.see(OAT);
  h.advance(300); h.result({ status: 'unsure' });
  h.advance(300); h.result({ status: 'unsure' });
  expect(h.effects).toEqual([{ type: 'still.request' }]);
});
it('R2: a new product in view replaces the pending product after 2 results in a row', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.advance(150); h.see(RYE);
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  expect(h.event('glance.cleared')).toEqual({ type: 'glance.cleared', promptId: 'p-0001' });
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R2: one stray result never replaces a prompt, while its line plays and after it', () => {
  const h = harness();
  h.show(OAT);
  h.advance(500); h.see(RYE);
  h.advance(150); h.see(OAT);
  h.done();
  h.advance(150); h.see(RYE);
  h.advance(150); h.result({ status: 'unsure' });
  h.advance(150); h.see(RYE);
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('R2: a result with no name, or with the name of the prompt, between two results starts the count again', () => {
  for (const between of [{ status: 'none' }, { status: 'unsure' }, { status: 'unknown' }, { status: 'identified', productId: OAT }] as const) {
    const h = harness();
    h.show(OAT); h.advance(150); h.see(RYE);
    h.advance(150); h.result(between);
    h.advance(150); h.see(RYE);
    expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
    h.advance(150); h.see(RYE);
    expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
  }
});
it('R2: the 2 results must come inside 1.5 seconds', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE);
  h.at(150 + SWITCH_WITHIN_MS + 1); h.see(RYE);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.advance(SWITCH_WITHIN_MS); h.see(RYE);
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R2: 2 results in a row for 2 other products do not replace the prompt', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE); h.advance(150); h.see(CRISPS);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.advance(150); h.see(CRISPS);
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: CRISPS });
});
it('R2: results that change between two products keep the first prompt', () => {
  const h = harness();
  h.show(OAT);
  // 9 seconds of frames, 150 ms apart.
  for (let frame = 0; frame < 30; frame += 1) {
    h.advance(150); h.see(RYE);
    expect(h.effects).toEqual([]);
    h.advance(150); h.see(OAT);
    expect(h.effects).toEqual([]);
  }
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('R2: results that change between two products in pairs give two prompts, and do not go back and forth', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE); h.advance(150); h.see(RYE);
  for (let frame = 0; frame < 15; frame += 1) {
    for (const productId of [OAT, OAT, RYE, RYE]) {
      h.advance(150); h.see(productId);
      expect(h.effects).toEqual([]);
    }
  }
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R2: the product that a prompt replaced gets its prompt again when sight did not name the other one for 1 second', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE); h.advance(150); h.see(RYE);
  h.advance(GO_BACK_AFTER_MS - 151); h.see(OAT);
  h.advance(150); h.see(OAT);
  expect(h.effects).toEqual([]);
  h.advance(1); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ id: 'p-0003', productId: OAT });
  // The same holds the other way now.
  h.advance(150); h.see(RYE); h.advance(150); h.see(RYE);
  expect(h.effects).toEqual([]);
});
it('R2: a barcode of another product replaces the prompt at once', () => {
  const h = harness();
  h.show(OAT); h.advance(150);
  h.barcode({ kind: 'product', productId: RYE });
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: RYE });
});
it('R2: a prompt that a barcode or a label match opened keeps its product against one result by sight', () => {
  const h = harness();
  h.barcode({ kind: 'product', productId: RYE });
  // The test of 2026-11-14: a label match named the can in the hand, and 0.5 seconds later one frame named a can on the table.
  h.advance(500); h.see(OAT);
  expect(h.effects).toEqual([]);
  h.advance(150); h.result({ status: 'unsure' });
  h.advance(150); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: RYE });
  h.advance(150); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ id: 'p-0002', productId: OAT });
});
it('R2: the product that a prompt replaced gets its prompt again with no wait when the shopper answered the other one', () => {
  const h = harness();
  h.show(OAT); h.advance(150); h.see(RYE); h.advance(150); h.see(RYE);
  h.done(); h.no();
  h.advance(150); h.show(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT });
});
it('R5: a product prompt ends when its product left the view for 15 seconds', () => {
  const h = harness();
  h.show(OAT);
  h.advance(T.viewMs + T.promptTtlAfterLeftMs - 1);
  expect(h.state.prompt).not.toBeNull();
  h.advance(1);
  expect(h.state.prompt).toBeNull();
  expect(h.events()).toEqual(['glance.cleared']);
});
it('R11: a product in the cart that comes into view gets the add-another prompt', () => {
  const h = harness({ cart: [OAT] });
  h.show(OAT);
  expect(h.state.prompt).toMatchObject({ kind: 'product', mode: 'inCart', productId: OAT });
  expect(h.event('glance.pending')).toMatchObject({ kind: 'inCart', qtyInCart: 1 });
  expect(h.speak()!.line).toMatchObject({ key: 'glance.inCart', qty: 1 });
});
it('R13: the unknown line plays one time for each appearance', () => {
  const h = harness();
  // The line waits 2 seconds for a second frame, which would ask the phone for a still (see barcode.test.ts).
  h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  h.advance(2000);
  expect(h.lines()).toEqual(['glance.unknown']);
  expect(h.events()).toEqual(['glance.unknown']);
  h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  // A new appearance inside 20 seconds: the guard drops the line with the same text (see guard.test.ts).
  h.advance(T.viewMs); h.result({ status: 'unknown' });
  h.advance(2000);
  expect(h.effects).toEqual([{ type: 'event', event: { type: 'glance.unknown' } }, { type: 'speak.dropped', line: { key: 'glance.unknown' }, reason: 'same text' }]);
  h.advance(SAME_TEXT_MS); h.result({ status: 'unknown' });
  h.advance(2000);
  expect(h.lines()).toEqual(['glance.unknown']);
  expect(h.all.filter((effect) => effect.type === 'speak')).toHaveLength(2);
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
// Each prompt by sight needs 2 results in a row for its product.
const hintsOf = (h: ReturnType<typeof harness>) => [OAT, RYE, BARISTA, CRISPS].map((id) => {
  h.see(id);
  if (h.speak() === undefined) h.see(id);
  return (h.speak()!.line as { hint: boolean }).hint;
});
it('adds the yes hint to the first two glance prompts only', () => {
  expect(hintsOf(harness())).toEqual([true, true, false, false]);
});
it('adds the yes hint to each glance prompt at the detailed level', () => {
  expect(hintsOf(harness({ profile: { detail: 'detailed' } }))).toEqual([true, true, true, true]);
});
it('ignores a result while the camera rests', () => {
  const h = harness();
  h.state = { ...h.state, phase: 'resting' };
  h.show(OAT);
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

it('says nothing for an unsure result with no aim hint', () => {
  const h = harness();
  h.result({ status: 'unsure' });
  expect(h.effects).toEqual([]);
});
it('says that it cannot tell look-alike products apart, one time for each appearance', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.event('glance.ambiguous')!.candidates.map((c) => c.id)).toEqual([OAT, BARISTA]);
  expect(h.lines()).toEqual([]);
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual([]);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  h.advance(500); h.result({ status: 'ambiguous', candidates: [BARISTA, OAT] });
  expect(h.effects).toEqual([]);
  h.advance(500); h.show(BARISTA);
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
});
it('keeps a prompt that a barcode or a label match opened when sight is not sure of its product', () => {
  const h = harness();
  h.barcode({ kind: 'product', productId: OAT });
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.done(); h.yes();
  expect(h.state.cart.items.map((item) => item.productId)).toEqual([OAT]);
});
it('a barcode for the product of the prompt of sight opens no second prompt', () => {
  const h = harness();
  h.show(OAT); h.advance(150);
  h.barcode({ kind: 'product', productId: OAT });
  expect(h.effects).toEqual([]);
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('keeps a prompt that the still of the second look opened when a stream frame cannot tell its product apart', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(3000);
  h.send({ type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: OAT, confidence: 1 }, still: true });
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  // The stream frame is smaller than the still, so it still cannot read the flavor.
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
});
it('keeps a prompt that stream frames opened when look-alike results have its product among their candidates', () => {
  const h = harness();
  h.show(OAT); h.done();
  for (let count = 0; count < 4; count += 1) {
    h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
    expect(h.effects).toEqual([]);
  }
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: OAT });
  h.yes('voice');
  expect(h.state.cart.items.map((item) => item.productId)).toEqual([OAT]);
});
it('look-alike results without the product of the prompt end the prompt as the second result in a row, when its product left the view', () => {
  const h = harness();
  h.show(RYE); h.done();
  h.advance(T.viewMs); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.cleared', 'glance.ambiguous']);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.state.prompt).toBeNull();
  h.yes('voice');
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('one look-alike result without the product of the prompt, among other results, never ends the prompt', () => {
  const h = harness();
  h.show(RYE);
  h.advance(T.viewMs);
  for (let count = 0; count < 3; count += 1) {
    h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
    h.advance(150); h.result({ status: 'none' });
    h.advance(150);
  }
  expect(h.all.filter((e) => e.type === 'event').map((e) => e.event.type)).toEqual(['glance.pending']);
  expect(h.state.prompt).toMatchObject({ id: 'p-0001', productId: RYE });
});
it('gives the look-alike answer with the product references of the contract, and with the defaults of its line', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.event('glance.ambiguous')).toEqual({
    type: 'glance.ambiguous',
    candidates: [
      { id: OAT, name: 'Oat drink', packSize: '1 L', priceCents: 189 },
      { id: BARISTA, name: 'Barista oat drink', packSize: '1 L', priceCents: 229 },
    ],
  });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.speak()).toMatchObject({ priority: 'normal', sound: null, interrupt: false, promptId: null });
  expect((h.speak()!.line as { products: { id: string }[] }).products.map((p) => p.id)).toEqual([OAT, BARISTA]);
  expect(h.state.prompt).toBeNull();
});
it('says nothing for look-alike products while the product of another prompt is in view', () => {
  const h = harness();
  h.show(RYE); h.advance(500);
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
});
it('gives one look-alike answer while the products stay in view, and a new one for a new appearance', () => {
  const h = harness();
  const ambiguous = () => h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  ambiguous();
  for (let elapsed = 0; elapsed < 2 * T.viewMs; elapsed += 500) { h.advance(500); ambiguous(); }
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
  // A new appearance gives its event. Inside 20 seconds the guard drops the line with the same text (see guard.test.ts).
  h.advance(T.viewMs); ambiguous();
  expect(h.events()).toEqual(['glance.ambiguous']);
  ambiguous();
  expect(h.effects).toMatchObject([{ type: 'speak.dropped', reason: 'same text' }]);
  h.advance(SAME_TEXT_MS); ambiguous(); ambiguous();
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('gives a new look-alike answer for other candidates', () => {
  const h = harness();
  lookAlike(h, [OAT, BARISTA]);
  h.advance(UNSOLICITED_GAP_MS); h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.event('glance.ambiguous')!.candidates.map((c) => c.id)).toEqual([OAT, RYE]);
  expect(h.lines()).toEqual([]);
  h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('other candidates less than 3 seconds later give their event, and the guard drops their line', () => {
  const h = harness();
  lookAlike(h, [OAT, BARISTA]);
  h.advance(500); h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.event('glance.ambiguous')!.candidates.map((c) => c.id)).toEqual([OAT, RYE]);
  h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.effects).toMatchObject([{ type: 'speak.dropped', reason: 'gap' }]);
});
it('gives the look-alike answer again when the model named one candidate in between', () => {
  const h = harness();
  lookAlike(h, [OAT, BARISTA]);
  h.advance(500); h.show(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT });
  // No look-alike line while the prompt of one of its candidates is open.
  h.advance(500); lookAlike(h, [OAT, BARISTA]);
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ productId: OAT });
  h.done(); h.no();
  h.advance(SAME_TEXT_MS); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('starts with no look-alike appearance', () => {
  expect(harness().state).toMatchObject({ ambiguousKey: null, ambiguousAt: null });
});
it('gives no aim hint for look-alike products', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.event('glance.hint')).toBeUndefined();
  expect(h.state.aimHintAt).toBeNull();
});
it('says nothing for candidates that the catalog does not hold', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, 'no-such-product'] });
  expect(h.effects).toEqual([]);
});
it('says nothing for an unknown result while the product of the current prompt is in view', () => {
  const h = harness();
  h.show(OAT); h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  expect(h.state.unknownAt).toBeNull();
});
it('makes no prompt for a product ID that the catalog does not hold', () => {
  const h = harness();
  h.show('no-such-product');
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});
it('keeps the last spoken line for the repeat intent', () => {
  const h = harness();
  h.show(OAT);
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

const still = (part: Partial<RecognitionResult>) => ({ type: 'recognition' as const, result: { ...NO_RESULT, ...part }, still: true });
const spokenKeys = (h: Harness) => h.all.filter((e): e is SpeakEffect => e.type === 'speak').map((e) => e.line.key);
/** 2 look-alike results in a row at one time: the line of their appearance is due with the second one. */
const lookAlike = (h: Harness, candidates: string[]) => {
  h.result({ status: 'ambiguous', candidates });
  h.result({ status: 'ambiguous', candidates });
};
const waiting = () => {
  const h = harness({ secondLookWaitMs: 2500 });
  lookAlike(h, [OAT, BARISTA]);
  return h;
};

it('says the look-alike line with the second look-alike result in a row, and gives the event with the first one', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.lines()).toEqual([]);
  h.advance(150); h.result({ status: 'ambiguous', candidates: [BARISTA, OAT] });
  expect(h.events()).toEqual([]);
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('a result between 2 look-alike results starts their count again', () => {
  const others = [
    { status: 'none' }, { status: 'unsure' }, { status: 'unknown' }, { status: 'identified', productId: RYE },
    { status: 'ambiguous', candidates: [RYE, CRISPS] },
  ] satisfies Partial<RecognitionResult>[];
  for (const between of others) {
    const h = harness();
    h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
    h.advance(150); h.result(between);
    h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
    expect(spokenKeys(h)).toEqual([]);
    h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
    expect(spokenKeys(h)).toEqual(['glance.ambiguous']);
  }
});
it('the 2 look-alike results must come inside 1.5 seconds', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.at(ALIKE_WITHIN_MS + 1); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(spokenKeys(h)).toEqual([]);
  h.advance(ALIKE_WITHIN_MS); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(spokenKeys(h)).toEqual(['glance.ambiguous']);
});
it('gives no aim hint while a still is on its way, also after a look-alike result', () => {
  const h = harness();
  h.result({ status: 'unsure' });
  h.advance(300); h.result({ status: 'unsure' });
  expect(h.effects).toEqual([{ type: 'still.request' }]);
  h.advance(300); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(300); h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.effects).toEqual([]);
  h.label('started');
  h.advance(STILL_ANSWER_MS); h.result({ status: 'unsure', aimHint: 'left' });
  expect(h.effects).toEqual([]);
});
it('holds the look-alike line for the still, and a sure still gives the normal prompt', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(150); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  // The wait counts from the event, which asked the phone for the still.
  expect(h.state.heldAmbiguous).toEqual({ products: [OAT, BARISTA], since: h.now - 150 });
  h.advance(1350); h.send(still({ status: 'identified', productId: BARISTA }));
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.new']);
});
it('speaks the line when no still comes in time', () => {
  const h = waiting();
  h.advance(2499);
  expect(spokenKeys(h)).toEqual([]);
  h.advance(1);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.speak()!.line).toMatchObject({ products: [{ id: OAT }, { id: BARISTA }] });
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.ambiguous']);
});
it('speaks the line at once when the still is not sure', () => {
  const h = waiting();
  h.advance(1200); h.send(still({ status: 'ambiguous', candidates: [OAT, BARISTA] }));
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.events()).toEqual([]);
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.ambiguous']);
});
it('speaks the held line, and no other line, for a still with each other result', () => {
  for (const part of [{ status: 'unknown' }, { status: 'unsure', aimHint: 'left' }, { status: 'none' }, { status: 'identified', productId: 'no-such-product' }] as const) {
    const h = waiting();
    h.advance(1000); h.send(still(part));
    expect(h.lines()).toEqual(['glance.ambiguous']);
    expect(h.events()).toEqual([]);
    expect(h.state.prompt).toBeNull();
  }
});
it('holds one line while the stream repeats the look-alike result, and speaks it one time', () => {
  const h = waiting();
  for (let elapsed = 500; elapsed <= 2000; elapsed += 500) { h.advance(500); h.result({ status: 'ambiguous', candidates: [BARISTA, OAT] }); }
  expect(spokenKeys(h)).toEqual([]);
  expect(h.all.filter((e) => e.type === 'event')).toHaveLength(1);
  h.advance(500);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  h.advance(500); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
});
it('drops the held line when the stream names one product', () => {
  const h = waiting();
  h.advance(500); h.see(OAT);
  expect(h.state.heldAmbiguous).not.toBeNull();
  h.advance(150); h.see(OAT);
  expect(h.lines()).toEqual(['glance.new']);
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.new']);
});
it('a sure still that comes after the line gives the normal prompt', () => {
  const h = waiting();
  h.advance(2500);
  h.advance(500); h.send(still({ status: 'identified', productId: OAT }));
  expect(h.events()).toEqual(['glance.pending']);
  expect(spokenKeys(h)).toEqual(['glance.ambiguous', 'glance.new']);
});
it('a still that is not sure says nothing when no line waits', () => {
  const h = waiting();
  h.advance(2500);
  h.advance(500); h.send(still({ status: 'unknown' }));
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs); h.send(still({ status: 'ambiguous', candidates: [OAT, BARISTA] }));
  expect(h.effects).toEqual([]);
});
it('holds the line of other candidates from the time of their result', () => {
  const h = waiting();
  h.advance(1000); h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.state.heldAmbiguous).toEqual({ products: [OAT, RYE], since: h.now });
  h.advance(2499);
  expect(spokenKeys(h)).toEqual([]);
  h.advance(1);
  expect(h.speak()!.line).toMatchObject({ key: 'glance.ambiguous', products: [{ id: OAT }, { id: RYE }] });
});
it('drops the held line when the session stops, and when a payment is confirmed', () => {
  const stopped = waiting();
  stopped.advance(500); stopped.intent('stop');
  stopped.advance(2500);
  expect(spokenKeys(stopped)).toEqual(['device.cameraOff']);
  expect(stopped.state.heldAmbiguous).toBeNull();

  const paying = harness({ secondLookWaitMs: 2500, cart: [RYE] });
  paying.kiosk(); paying.done();
  lookAlike(paying, [OAT, BARISTA]);
  paying.advance(500); paying.kiosk(); paying.yes('phone');
  expect(paying.state.checkout).toMatchObject({ step: 'paying' });
  paying.advance(2500);
  expect(spokenKeys(paying)).toEqual(['checkout.offer']);
  expect(paying.state.heldAmbiguous).toBeNull();
  expect(KIOSK.id).toBe(paying.state.checkout!.kiosk.id);
});
it('with no wait, a still counts as a stream frame', () => {
  const h = harness();
  expect(h.ctx.secondLookWaitMs).toBe(0);
  lookAlike(h, [OAT, BARISTA]);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(1000); h.send(still({ status: 'ambiguous', candidates: [OAT, BARISTA] }));
  expect(h.effects).toEqual([]);
  h.advance(500); h.send(still({ status: 'identified', productId: BARISTA }));
  expect(h.lines()).toEqual(['glance.new']);
});
