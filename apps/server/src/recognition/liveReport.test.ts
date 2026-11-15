import { expect, it } from 'vitest';
import { indexCatalog } from '../catalog/catalog';
import { LIVE_FORMS, REPORT_VIEW, buildLiveInstruction, reportViewDeclaration, resultFromReport } from './liveReport';
import { NO_RESULT, normalizeResult } from './result';

const catalog = indexCatalog([]);
const ids = ['oat-drink-1l', 'gtin-5999571058020'];
const known = { get: (id: string) => (ids.includes(id) ? ({ id } as never) : undefined), products: catalog.products } as typeof catalog;
const normalize = (args: unknown) => normalizeResult(resultFromReport(args), { catalog: known, exclude: [], minConfidence: 0.6 });

it('declares report_view with the product IDs as the only values of productId and candidates', () => {
  const declaration = reportViewDeclaration(ids);
  expect(declaration.name).toBe(REPORT_VIEW);
  const schema = declaration.parametersJsonSchema as {
    required: string[]; properties: Record<string, { enum?: string[]; anyOf?: { enum?: string[] }[]; items?: { enum: string[] } }>;
  };
  expect(schema.required).toEqual(['status', 'productId', 'confidence', 'aimHint', 'codeVisible', 'codeDigits']);
  expect(schema.properties.productId!.anyOf!.find((part) => part.enum)!.enum).toEqual(ids);
  expect(schema.properties.candidates!.items!.enum).toEqual(ids);
});
it('declares a productId that can only be null when no product has an ID', () => {
  const schema = reportViewDeclaration([]).parametersJsonSchema as { properties: Record<string, { type?: string }> };
  expect(schema.properties.productId).toEqual({ type: 'null' });
});

it('gives the arguments of a call to normalizeResult as the answer of the per-frame call', () => {
  expect(normalize({
    status: 'identified', productId: 'gtin-5999571058020', confidence: 0.9, aimHint: 'none', codeVisible: true, codeDigits: '5999571058020',
  })).toEqual({
    status: 'identified', productId: 'gtin-5999571058020', candidates: [], confidence: 0.9, aimHint: 'none', gesture: 'none',
    code: { visible: true, digits: '5999571058020' },
  });
});
it('keeps the candidates of an ambiguous call', () => {
  const result = normalize({
    status: 'ambiguous', productId: null, candidates: ids, confidence: 0.5, aimHint: 'turn', codeVisible: false, codeDigits: null,
  });
  expect(result.status).toBe('ambiguous');
  expect(result.candidates).toEqual(ids);
});
it('takes a call with no code fields as a call with no code', () => {
  const result = normalize({ status: 'unsure', productId: null, confidence: 0.3, aimHint: 'closer' });
  expect(result).toMatchObject({ status: 'unsure', aimHint: 'closer', code: { visible: false, digits: null } });
});
it('never names a product for arguments that are no report', () => {
  expect(normalize(null)).toBe(NO_RESULT);
  expect(normalize('identified')).toBe(NO_RESULT);
  expect(normalize({ status: 'identified', productId: 'gtin-5999571058020' })).toBe(NO_RESULT);
  expect(normalize({ status: 'identified', productId: 'other', confidence: 0.9, aimHint: 'none' }).status).toBe('unknown');
  expect(normalize({ status: 'identified', productId: 'oat-drink-1l', confidence: 0.4, aimHint: 'none' }).status).toBe('unsure');
});

it('adds the section of the form to the instruction of the per-frame call', () => {
  for (const form of LIVE_FORMS) {
    const text = buildLiveInstruction('Base rules.', form);
    expect(text.startsWith('Base rules.\n\n## Live session\n')).toBe(true);
    expect(text).toContain(REPORT_VIEW);
  }
  expect(new Set(LIVE_FORMS.map((form) => buildLiveInstruction('', form))).size).toBe(LIVE_FORMS.length);
});
