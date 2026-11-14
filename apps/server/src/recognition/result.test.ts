import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { BARISTA, OAT } from '../sessions/harness';
import { NO_RESULT, normalizeResult } from './result';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const ctx = { catalog, exclude: [] as string[], minConfidence: 0.6 };
const raw = (part: object) => ({ ...NO_RESULT, confidence: 0.9, ...part });

it('keeps a good identified result', () => {
  const good = raw({ status: 'identified', productId: OAT });
  expect(normalizeResult(good, ctx)).toEqual(good);
});
it('turns broken input into no result', () => {
  expect(normalizeResult(undefined, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult({ status: 'identified' }, ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(raw({ status: 'sure' }), ctx)).toEqual(NO_RESULT);
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, confidence: 1.5 }), ctx)).toEqual(NO_RESULT);
});
it('never names a product outside the catalog', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: 'cola-zero' }), ctx)).toMatchObject({ status: 'unknown', productId: null });
  expect(normalizeResult(raw({ status: 'identified', productId: null }), ctx).status).toBe('unknown');
});
it('drops an excluded product', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: OAT }), { ...ctx, exclude: [OAT] }).status).toBe('none');
});
it('turns a weak identified result into unsure', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, confidence: 0.59, aimHint: 'closer' }), ctx))
    .toEqual(raw({ status: 'unsure', confidence: 0.59, aimHint: 'closer' }));
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, confidence: 0.6 }), ctx).status).toBe('identified');
});
it('needs two known candidates for ambiguous', () => {
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, BARISTA, 'x'] }), ctx).candidates).toEqual([OAT, BARISTA]);
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, 'x'] }), ctx))
    .toMatchObject({ status: 'unsure', aimHint: 'turn', candidates: [] });
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: ['x'] }), ctx).status).toBe('unknown');
});
it('counts a candidate one time, and drops an excluded candidate', () => {
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, OAT] }), ctx)).toMatchObject({ status: 'unsure', aimHint: 'turn' });
  expect(normalizeResult(raw({ status: 'ambiguous', candidates: [OAT, BARISTA] }), { ...ctx, exclude: [BARISTA] }))
    .toMatchObject({ status: 'unsure', candidates: [] });
});
it('keeps productId only for identified', () => {
  expect(normalizeResult(raw({ status: 'unsure', productId: OAT, aimHint: 'left' }), ctx).productId).toBeNull();
  expect(normalizeResult(raw({ status: 'ambiguous', productId: OAT, candidates: [OAT, BARISTA] }), ctx).productId).toBeNull();
});
it('keeps candidates only for ambiguous', () => {
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, candidates: [BARISTA] }), ctx).candidates).toEqual([]);
  expect(normalizeResult(raw({ status: 'unknown', candidates: [OAT, BARISTA] }), ctx).candidates).toEqual([]);
});
it('never turns another status into identified', () => {
  for (const status of ['ambiguous', 'unsure', 'unknown', 'none']) {
    const result = normalizeResult(raw({ status, productId: OAT, candidates: [OAT], confidence: 1 }), ctx);
    expect(result.status).not.toBe('identified');
    expect(result.productId).toBeNull();
  }
});
it('keeps the code of the frame with each status', () => {
  const code = { visible: true, digits: '8076800195057' };
  expect(normalizeResult(raw({ status: 'none', code }), ctx).code).toEqual(code);
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, code }), ctx).code).toEqual(code);
  expect(normalizeResult(raw({ status: 'identified', productId: 'cola-zero', code }), ctx)).toMatchObject({ status: 'unknown', code });
  expect(normalizeResult(raw({ status: 'identified', productId: OAT, code }), { ...ctx, exclude: [OAT] }))
    .toEqual({ ...NO_RESULT, code });
});
it('removes the spaces of the digits, and drops digits that are no digits', () => {
  expect(normalizeResult(raw({ code: { visible: true, digits: '8 076800 195057' } }), ctx).code)
    .toEqual({ visible: true, digits: '8076800195057' });
  expect(normalizeResult(raw({ code: { visible: true, digits: '80768O0195057' } }), ctx).code).toEqual({ visible: true, digits: null });
  expect(normalizeResult(raw({ code: { visible: true, digits: '' } }), ctx).code).toEqual({ visible: true, digits: null });
});
it('counts a code with digits as visible', () => {
  expect(normalizeResult(raw({ code: { visible: false, digits: '73513537' } }), ctx).code).toEqual({ visible: true, digits: '73513537' });
});
it('reads an answer with no code, or with a bad code, as a frame with no code', () => {
  const { code: _code, ...old } = raw({ status: 'identified', productId: OAT });
  expect(normalizeResult(old, ctx)).toEqual(raw({ status: 'identified', productId: OAT }));
  expect(normalizeResult(raw({ status: 'unknown', code: { visible: 'yes' } }), ctx)).toEqual(raw({ status: 'unknown' }));
});
