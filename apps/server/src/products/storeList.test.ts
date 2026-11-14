import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { hasGs1CheckDigit } from '@glance/shared';
import { DEFAULT_STORE_LIST_PATH, readStoreListFile } from './storeList';

const tempDir = mkdtempSync(join(tmpdir(), 'glance-store-list-'));
let fileCount = 0;
function tempList(content: unknown): string {
  fileCount += 1;
  const path = join(tempDir, `list-${fileCount}.json`);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

const nutella = { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' };

it('finds an item by its 13 digits', async () => {
  const list = readStoreListFile(tempList([nutella, { gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5' }]));
  expect(await list.byGtin('3017624010701')).toEqual(nutella);
  expect(await list.byGtin('8076800195057')).toEqual({ gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5' });
  expect(await list.byGtin('8001250120120')).toBeUndefined();
  expect(await list.all()).toHaveLength(2);
});
it('keeps a code of 8 or 12 digits as 13 digits', async () => {
  const list = readStoreListFile(tempList([
    { gtin: '80177173', priceCents: 45, name: 'Nutella' }, { gtin: '036000291452', priceCents: 250, name: 'Tissues' },
  ]));
  expect((await list.byGtin('0000080177173'))?.gtin).toBe('0000080177173');
  expect((await list.byGtin('0036000291452'))?.name).toBe('Tissues');
});
it('rejects a wrong check digit and names the entry', () => {
  expect(() => readStoreListFile(tempList([nutella, { ...nutella, gtin: '3017624010702' }]))).toThrow(/entry 1.*3017624010702.*check digit/);
  expect(() => readStoreListFile(tempList([{ ...nutella, gtin: '30176240107' }]))).toThrow(/entry 0.*8, 12, or 13 digits/);
});
it('rejects one code two times, also in two forms', () => {
  expect(() => readStoreListFile(tempList([nutella, { ...nutella, priceCents: 1 }]))).toThrow(/entry 1.*3017624010701 two times/);
  expect(() => readStoreListFile(tempList([
    { gtin: '036000291452', priceCents: 250, name: 'Tissues' }, { gtin: '0036000291452', priceCents: 250, name: 'Tissues' },
  ]))).toThrow(/two times/);
});
it('rejects an entry with a bad field, a price of 0, and an unknown key', () => {
  expect(() => readStoreListFile(tempList([{ gtin: '3017624010701', name: 'Nutella' }]))).toThrow(/entry 0.*priceCents/);
  expect(() => readStoreListFile(tempList([{ ...nutella, priceCents: 0 }]))).toThrow(/entry 0.*priceCents/);
  expect(() => readStoreListFile(tempList([{ ...nutella, name: '' }]))).toThrow(/entry 0.*name/);
  expect(() => readStoreListFile(tempList([{ ...nutella, price: 3.99 }]))).toThrow(/entry 0/);
});
it('rejects a file that is no JSON array, and a missing file', () => {
  expect(() => readStoreListFile(tempList({ items: [] }))).toThrow(/must hold a JSON array/);
  expect(() => readStoreListFile(tempList('[{'))).toThrow(/Cannot read the store list file/);
  expect(() => readStoreListFile(join(tempDir, 'missing.json'))).toThrow(/Cannot read the store list file/);
});
it('the dev store list holds real codes with a price, a brand, and a pack size', async () => {
  const items = await readStoreListFile(DEFAULT_STORE_LIST_PATH).all();
  expect(items.length).toBeGreaterThanOrEqual(10);
  for (const item of items) {
    expect(item.gtin).toMatch(/^\d{13}$/);
    expect(hasGs1CheckDigit(item.gtin)).toBe(true);
    expect(item.priceCents).toBeGreaterThan(0);
    expect(item.brand).toBeTruthy();
    expect(item.packSize).toBeTruthy();
  }
  expect(items.map((item) => item.gtin)).toContain('3017624010701');
});
