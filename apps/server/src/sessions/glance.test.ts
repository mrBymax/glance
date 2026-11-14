import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { NO_RESULT, type RecognitionResult, RecognitionResultSchema } from '../recognition/result';
import { BARISTA, CRISPS, type Harness, KIOSK, OAT, RYE, harness } from './harness';
import { LINE_DEFAULTS, say } from './say';
import { step } from './step';
import type { SpeakEffect } from './types';
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
  expect(h.lines()).toEqual(['glance.ambiguous']);
  h.advance(500); h.result({ status: 'ambiguous', candidates: [BARISTA, OAT] });
  expect(h.effects).toEqual([]);
  h.advance(500); h.see(BARISTA);
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
});
it('ends a prompt for a product that the model is no longer sure of', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.cleared', 'glance.ambiguous']);
  h.yes('voice');
  expect(h.state.cart).toEqual(EMPTY_CART);
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
  expect(h.speak()).toMatchObject({ priority: 'normal', sound: null, interrupt: false, promptId: null });
  expect((h.speak()!.line as { products: { id: string }[] }).products.map((p) => p.id)).toEqual([OAT, BARISTA]);
  expect(h.state.prompt).toBeNull();
});
it('says nothing for look-alike products while the product of another prompt is in view', () => {
  const h = harness();
  h.see(RYE); h.advance(500);
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
  h.advance(T.viewMs);
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
});
it('gives one look-alike answer while the products stay in view, and a new one for a new appearance', () => {
  const h = harness();
  const ambiguous = () => h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  ambiguous();
  for (let elapsed = 0; elapsed < 2 * T.viewMs; elapsed += 500) { h.advance(500); ambiguous(); }
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
  h.advance(T.viewMs); ambiguous();
  expect(h.lines()).toEqual(['glance.ambiguous']);
});
it('gives a new look-alike answer for other candidates', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(500); h.result({ status: 'ambiguous', candidates: [OAT, RYE] });
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.event('glance.ambiguous')!.candidates.map((c) => c.id)).toEqual([OAT, RYE]);
});
it('gives the look-alike answer again when the model named one candidate in between', () => {
  const h = harness();
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  h.advance(500); h.see(OAT);
  expect(h.state.prompt).toMatchObject({ productId: OAT });
  h.advance(500); h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.cleared', 'glance.ambiguous']);
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.state.prompt).toBeNull();
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

const still = (part: Partial<RecognitionResult>) => ({ type: 'recognition' as const, result: { ...NO_RESULT, ...part }, still: true });
const spokenKeys = (h: Harness) => h.all.filter((e): e is SpeakEffect => e.type === 'speak').map((e) => e.line.key);
const waiting = () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  return h;
};

it('holds the look-alike line for the still, and a sure still gives the normal prompt', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.lines()).toEqual([]);
  expect(h.state.heldAmbiguous).toEqual({ products: [OAT, BARISTA], since: h.now });
  h.advance(1500); h.send(still({ status: 'identified', productId: BARISTA }));
  expect(h.state.prompt).toMatchObject({ productId: BARISTA });
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(2500);
  expect(spokenKeys(h)).toEqual(['glance.new']);
});
it('speaks the line when no still comes in time', () => {
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
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
  const h = harness({ secondLookWaitMs: 2500 });
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
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
it('drops the held line when a stream frame names one product', () => {
  const h = waiting();
  h.advance(500); h.see(OAT);
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
  paying.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
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
  h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  expect(h.lines()).toEqual(['glance.ambiguous']);
  expect(h.state.heldAmbiguous).toBeNull();
  h.advance(1000); h.send(still({ status: 'ambiguous', candidates: [OAT, BARISTA] }));
  expect(h.effects).toEqual([]);
  h.advance(500); h.send(still({ status: 'identified', productId: BARISTA }));
  expect(h.lines()).toEqual(['glance.new']);
});
