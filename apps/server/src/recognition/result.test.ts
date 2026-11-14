import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { BARISTA, OAT } from '../sessions/harness';
import { NO_RESULT, normalizeResult } from './result';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const ctx = { catalog, exclude: [] as string[], minConfidence: 0.6 };
/** A good answer of the model: a hand holds the product. A result has no `held` field. */
const raw = (part: object) => ({ ...NO_RESULT, confidence: 0.9, ...part });
const answer = (part: object) => ({ ...raw(part), held: true });

it('keeps a good identified result', () => {
  const good = raw({ status: 'identified', productId: OAT });
  expect(normalizeResult({ ...good, held: true }, ctx)).toEqual(good);
});
it('turns broken input into no result', () => {
  expect(normalizeResult(undefined, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult({ status: 'identified' }, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(raw({ status: 'identified', productId: OAT }), ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(answer({ status: 'sure' }), ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, confidence: 1.5 }), ctx)).toEqual(NO_RESULT);
});
it('never names a product outside the catalog', () => {
  expect(normalizeResult(answer({ status: 'identified', productId: 'cola-zero' }), ctx)).toMatchObject({ status: 'unknown', productId: null });
  expect(normalizeResult(answer({ status: 'identified', productId: null }), ctx).status).toBe('unknown');
});
it('drops an excluded product', () => {
  expect(normalizeResult(answer({ status: 'identified', productId: OAT }), { ...ctx, exclude: [OAT] }).status).toBe('none');
});
it('turns a weak identified result into unsure', () => {
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, confidence: 0.59, aimHint: 'closer' }), ctx))
    .toEqual(raw({ status: 'unsure', confidence: 0.59, aimHint: 'closer' }));
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, confidence: 0.6 }), ctx).status).toBe('identified');
});
it('needs two known candidates for ambiguous', () => {
  expect(normalizeResult(answer({ status: 'ambiguous', candidates: [OAT, BARISTA, 'x'] }), ctx).candidates).toEqual([OAT, BARISTA]);
  expect(normalizeResult(answer({ status: 'ambiguous', candidates: [OAT, 'x'] }), ctx))
    .toMatchObject({ status: 'unsure', aimHint: 'turn', candidates: [] });
  expect(normalizeResult(answer({ status: 'ambiguous', candidates: ['x'] }), ctx).status).toBe('unknown');
});
it('counts a candidate one time, and drops an excluded candidate', () => {
  expect(normalizeResult(answer({ status: 'ambiguous', candidates: [OAT, OAT] }), ctx)).toMatchObject({ status: 'unsure', aimHint: 'turn' });
  expect(normalizeResult(answer({ status: 'ambiguous', candidates: [OAT, BARISTA] }), { ...ctx, exclude: [BARISTA] }))
    .toMatchObject({ status: 'unsure', candidates: [] });
});
it('keeps productId only for identified', () => {
  expect(normalizeResult(answer({ status: 'unsure', productId: OAT, aimHint: 'left' }), ctx).productId).toBeNull();
  expect(normalizeResult(answer({ status: 'ambiguous', productId: OAT, candidates: [OAT, BARISTA] }), ctx).productId).toBeNull();
});
it('keeps candidates only for ambiguous', () => {
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, candidates: [BARISTA] }), ctx).candidates).toEqual([]);
  expect(normalizeResult(answer({ status: 'unknown', candidates: [OAT, BARISTA] }), ctx).candidates).toEqual([]);
});
it('never turns another status into identified', () => {
  for (const status of ['ambiguous', 'unsure', 'unknown', 'none']) {
    const result = normalizeResult(answer({ status, productId: OAT, candidates: [OAT], confidence: 1 }), ctx);
    expect(result.status).not.toBe('identified');
    expect(result.productId).toBeNull();
  }
});
it('keeps the code of the frame with each status', () => {
  const code = { visible: true, digits: '8076800195057' };
  expect(normalizeResult(answer({ status: 'none', code }), ctx).code).toEqual(code);
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, code }), ctx).code).toEqual(code);
  expect(normalizeResult(answer({ status: 'identified', productId: 'cola-zero', code }), ctx)).toMatchObject({ status: 'unknown', code });
  expect(normalizeResult(answer({ status: 'identified', productId: OAT, code }), { ...ctx, exclude: [OAT] }))
    .toEqual({ ...NO_RESULT, code });
});
it('removes the spaces of the digits, and drops digits that are no digits', () => {
  expect(normalizeResult(answer({ code: { visible: true, digits: '8 076800 195057' } }), ctx).code)
    .toEqual({ visible: true, digits: '8076800195057' });
  expect(normalizeResult(answer({ code: { visible: true, digits: '80768O0195057' } }), ctx).code).toEqual({ visible: true, digits: null });
  expect(normalizeResult(answer({ code: { visible: true, digits: '' } }), ctx).code).toEqual({ visible: true, digits: null });
});
it('counts a code with digits as visible', () => {
  expect(normalizeResult(answer({ code: { visible: false, digits: '73513537' } }), ctx).code).toEqual({ visible: true, digits: '73513537' });
});
it('reads an answer with no code, or with a bad code, as a frame with no code', () => {
  const { code: _code, ...old } = answer({ status: 'identified', productId: OAT });
  expect(normalizeResult(old, ctx)).toEqual(raw({ status: 'identified', productId: OAT }));
  expect(normalizeResult(answer({ status: 'unknown', code: { visible: 'yes' } }), ctx)).toEqual(raw({ status: 'unknown' }));
});
it('turns each answer about a product that no hand holds into no product', () => {
  const code = { visible: true, digits: '8076800195057' };
  for (const part of [
    { status: 'identified', productId: OAT }, { status: 'ambiguous', candidates: [OAT, BARISTA] },
    { status: 'unsure', aimHint: 'turn' }, { status: 'unknown' }, { status: 'none', gesture: 'thumbs_up', code },
  ]) {
    expect(normalizeResult({ ...raw(part), held: false }, ctx)).toEqual(NO_RESULT);
  }
});
it('drops digits that are the code of an item whose ID shows them: the model can copy them from the instruction', () => {
  const listed = { ...ctx, shownCodes: new Set(['3017624010701']) };
  expect(normalizeResult(answer({ status: 'unsure', code: { visible: true, digits: '3017624010701' } }), listed).code)
    .toEqual({ visible: true, digits: null });
  expect(normalizeResult(answer({ code: { visible: false, digits: '3017 6240 10701' } }), listed).code).toEqual({ visible: true, digits: null });
  // Another code, and a code with a wrong check digit, stay: the lookup decides about them.
  expect(normalizeResult(answer({ code: { visible: true, digits: '8076800195057' } }), listed).code.digits).toBe('8076800195057');
  expect(normalizeResult(answer({ code: { visible: true, digits: '3017624010702' } }), listed).code.digits).toBe('3017624010702');
});
it('keeps a UPC-A form of a shown code out too', () => {
  const listed = { ...ctx, shownCodes: new Set(['0036000291452']) };
  expect(normalizeResult(answer({ code: { visible: true, digits: '036000291452' } }), listed).code).toEqual({ visible: true, digits: null });
});
