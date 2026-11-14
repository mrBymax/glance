import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { ProductSchema } from '@glance/shared';
import oatDrink from '@glance/shared/fixtures/catalog/oat-drink-1l.json';
import { indexCatalog, readCatalogFile } from './catalog';

const dev = readCatalogFile('catalog/catalog.dev.json');

const tempDir = mkdtempSync(join(tmpdir(), 'glance-catalog-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));
function tempFile(name: string, content: string): string {
  const path = join(tempDir, name);
  writeFileSync(path, content);
  return path;
}

it('holds the oat drink of the shared fixture', () => {
  expect(indexCatalog(dev).get('oat-drink-1l')).toEqual(ProductSchema.parse(oatDrink));
});
it('has the prices that the spec script uses', () => {
  expect(Object.fromEntries(dev.map((p) => [p.id, p.priceCents]))).toEqual({
    'oat-drink-1l': 189, 'oat-drink-barista-1l': 229, 'rye-bread': 260, 'potato-crisps': 190,
  });
});
it('has one product with no allergen data', () => {
  expect(indexCatalog(dev).get('potato-crisps')!.allergens).toBeNull();
});
it('has a visual sentence of 20 characters or more for each product', () => {
  expect(dev.filter((p) => p.visual.length < 20)).toEqual([]);
});
it('names only products of the catalog as look-alikes', () => {
  const index = indexCatalog(dev);
  const missing = dev.flatMap((p) => p.lookAlikes).filter((id) => !index.get(id));
  expect(missing).toEqual([]);
});
it('rejects a duplicate ID', () => {
  expect(() => indexCatalog([dev[0]!, dev[0]!])).toThrow(/oat-drink-1l/);
});
it('returns undefined for an unknown ID', () => {
  expect(indexCatalog(dev).get('no-such-product')).toBeUndefined();
  expect(indexCatalog(dev).get('toString')).toBeUndefined();
});
it('names the entry that fails the schema', () => {
  const valid = dev[0]!;
  const path = tempFile('bad-entry.json', JSON.stringify([valid, { ...valid, id: 'rye-bread', priceCents: 1.5 }]));
  expect(() => readCatalogFile(path)).toThrow(/entry 1.*rye-bread/);
});
it('rejects a file that is not a JSON array', () => {
  expect(() => readCatalogFile(tempFile('object.json', '{"products":[]}'))).toThrow(/array/);
  expect(() => readCatalogFile(tempFile('broken.json', '[{'))).toThrow(/broken\.json/);
  expect(() => readCatalogFile(join(tempDir, 'missing.json'))).toThrow(/missing\.json/);
});
