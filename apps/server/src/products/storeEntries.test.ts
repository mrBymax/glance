import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import { createFakeProductInfo } from './fakeProductInfo';
import type { ProductDetails, ProductInfo } from './productInfo';
import { notInCatalog, readStoreEntries } from './storeEntries';
import { DEFAULT_STORE_LIST_PATH, type StoreItem, type StoreList, readStoreListFile } from './storeList';

const nutella: StoreItem = { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' };
const cups: StoreItem = { gtin: '6438574558384', priceCents: 349, name: 'Paper cups' };
const barista: StoreItem = { gtin: '7394376616037', priceCents: 229, name: 'Barista oat drink', brand: 'Oatly', packSize: '1 L' };
const details: ProductDetails = { brand: 'Ferrero', quantity: '400 g', allergens: ['milk', 'nuts'], vegan: false, vegetarian: true };
const listOf = (items: StoreItem[]): StoreList => ({ byGtin: async (gtin) => items.find((item) => item.gtin === gtin), all: async () => items });

it('reads each item with the details that the reader holds, and makes no read of the database', async () => {
  const info = {
    byGtin: vi.fn<ProductInfo['byGtin']>(async () => details),
    cached: vi.fn<ProductInfo['cached']>(async (gtin) => (gtin === nutella.gtin ? details : null)),
    holds: async () => true,
  };
  expect(await readStoreEntries(listOf([nutella, cups]), info, () => undefined)).toEqual([
    { item: nutella, details }, { item: cups, details: null },
  ]);
  expect(info.byGtin).not.toHaveBeenCalled();
});
it('an item whose details the reader cannot give has none, and the log says why', async () => {
  const lines: string[] = [];
  const info: ProductInfo = { byGtin: async () => details, cached: async () => { throw new Error('The cache folder is gone.'); }, holds: async () => true };
  expect(await readStoreEntries(listOf([cups]), info, (line) => { lines.push(line); })).toEqual([{ item: cups, details: null }]);
  expect(lines).toEqual(['product info: no details at the start. gtin=6438574558384 The cache folder is gone.']);
});
it('with the fixtures each item of the dev store list has its details', async () => {
  const entries = await readStoreEntries(readStoreListFile(DEFAULT_STORE_LIST_PATH), createFakeProductInfo(), () => undefined);
  expect(entries).toHaveLength(10);
  for (const entry of entries) expect(entry.details).not.toBeNull();
});
it('leaves out the items whose code a catalog product has', () => {
  const dev = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
  const entries = [nutella, barista, cups].map((item) => ({ item, details: null }));
  expect(notInCatalog(entries, dev).map((entry) => entry.item.name)).toEqual(['Nutella', 'Paper cups']);
  expect(notInCatalog(entries, [])).toEqual(entries);
});
