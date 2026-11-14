import { beforeEach, expect, it, vi } from 'vitest';
import type { Product } from '@glance/shared';
import { product } from '../sessions/harness';
import type { SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { createBarcodeReports } from './barcodes';
import type { ProductResolver } from './resolver';

const NUTELLA = '3017624010701';
const nutella = product('gtin-3017624010701', 399);

let resolve: ReturnType<typeof vi.fn<ProductResolver['resolve']>>;
let inputs: RuleInputBody[];
let session: SessionRuntime;
let stopped: boolean;
let info: string[];
let warn: string[];

beforeEach(() => {
  resolve = vi.fn<ProductResolver['resolve']>(async (gtin): Promise<Product | null> => (gtin === NUTELLA ? nutella : null));
  inputs = [];
  stopped = false;
  session = { id: 's-1', get stopped() { return stopped; }, dispatch: (input: RuleInputBody) => { inputs.push(input); } } as unknown as SessionRuntime;
  info = [];
  warn = [];
});
const reports = () => createBarcodeReports({
  resolver: { resolve }, log: { info: (line: string) => { info.push(line); }, warn: (line: string) => { warn.push(line); } },
});

it('gives the rules the product of a code of the phone', async () => {
  expect(await reports()(session, NUTELLA, 'barcode')).toBe('product');
  expect(inputs).toEqual([{ type: 'barcode', outcome: { kind: 'product', productId: 'gtin-3017624010701' } }]);
  expect(info.join('\n')).toMatch(/barcode session=s-1 source=barcode gtin=3017624010701 outcome=product ms=\d+/);
});
it('makes 13 digits of a code of 12 and of 8 digits before the lookup', async () => {
  await reports()(session, '036000291452', 'ocr');
  await reports()(session, '73513537', 'barcode');
  expect(resolve.mock.calls).toEqual([['0036000291452'], ['0000073513537']]);
  expect(inputs).toEqual([
    { type: 'barcode', outcome: { kind: 'notInStore', gtin: '0036000291452' } },
    { type: 'barcode', outcome: { kind: 'notInStore', gtin: '0000073513537' } },
  ]);
});
it('gives the rules the outcome invalid for a wrong check digit and for 14 digits, with no lookup', async () => {
  expect(await reports()(session, '3017624010702', 'barcode')).toBe('invalid');
  expect(await reports()(session, '10036000291452', 'barcode')).toBe('invalid');
  expect(resolve).not.toHaveBeenCalled();
  expect(inputs).toEqual([{ type: 'barcode', outcome: { kind: 'invalid' } }, { type: 'barcode', outcome: { kind: 'invalid' } }]);
});
it('a code that the model read counts only as a product of the store', async () => {
  for (const source of ['model', 'label'] as const) {
    expect(await reports()(session, NUTELLA, source)).toBe('product');
    expect(await reports()(session, '4006381333931', source)).toBe('notInStore');
    expect(await reports()(session, '3017624010702', source)).toBe('invalid');
  }
  expect(inputs).toEqual([
    { type: 'barcode', outcome: { kind: 'product', productId: 'gtin-3017624010701' } },
    { type: 'barcode', outcome: { kind: 'product', productId: 'gtin-3017624010701' } },
  ]);
});
it('drops a report when the lookup fails, and logs the cause', async () => {
  resolve.mockRejectedValueOnce(new Error('The store list did not answer in 2500 ms.'));
  expect(await reports()(session, NUTELLA, 'barcode')).toBe('dropped');
  expect(inputs).toEqual([]);
  expect(warn.join('\n')).toMatch(/barcode lookup failed. session=s-1 gtin=3017624010701 The store list did not answer/);
});
it('drops a result that arrives after the session stopped', async () => {
  let answer!: (value: Product | null) => void;
  resolve.mockImplementationOnce(() => new Promise((done) => { answer = done; }));
  const report = reports()(session, NUTELLA, 'barcode');
  stopped = true;
  answer(nutella);
  expect(await report).toBe('dropped');
  expect(inputs).toEqual([]);
  expect(await reports()(session, NUTELLA, 'barcode')).toBe('dropped');
  expect(resolve).toHaveBeenCalledTimes(1);
});
