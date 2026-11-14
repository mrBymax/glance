import { fileURLToPath } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import { ProductSchema } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { createFakeProductInfo } from './fakeProductInfo';
import type { ProductDetails, ProductInfo } from './productInfo';
import { ProductResolver } from './resolver';
import { ScannedProducts, gtinOfScannedId, scannedProduct, scannedProductId, spokenPack, withScanned } from './scanned';
import { DEFAULT_STORE_LIST_PATH, type StoreItem, type StoreList, readStoreListFile } from './storeList';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const storeList = readStoreListFile(DEFAULT_STORE_LIST_PATH);
const NUTELLA = '3017624010701';
const BARISTA = '7394376616037';
const nutella: StoreItem = { gtin: NUTELLA, priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' };
const details: ProductDetails = {
  name: { en: 'Hazelnut spread', it: 'Crema di nocciole', any: 'Nutella' }, brand: 'Ferrero SpA', quantity: '0.4 kg',
  allergens: ['milk', 'nuts'], vegan: false, vegetarian: true,
};

let scanned: ScannedProducts;
let logLines: string[];
beforeEach(() => {
  scanned = new ScannedProducts();
  logLines = [];
});

function resolver(over: { storeList?: StoreList; info?: ProductInfo; budgetMs?: number } = {}): ProductResolver {
  return new ProductResolver({
    catalog, storeList: over.storeList ?? storeList, info: over.info ?? createFakeProductInfo(), scanned,
    log: (line) => { logLines.push(line); }, ...(over.budgetMs === undefined ? {} : { budgetMs: over.budgetMs }),
  });
}
const never = <T>(): Promise<T> => new Promise(() => undefined);

it('writes the ID of a scanned product from its 13 digits', () => {
  expect(scannedProductId(NUTELLA)).toBe('gtin-3017624010701');
  expect(gtinOfScannedId('gtin-3017624010701')).toBe(NUTELLA);
  expect(gtinOfScannedId('oat-drink-1l')).toBeNull();
  expect(gtinOfScannedId('gtin-30176240107')).toBeNull();
});
it('builds a product from the store item and the details', () => {
  const product = scannedProduct(nutella, details);
  expect(product).toMatchObject({
    id: 'gtin-3017624010701', gtin: NUTELLA, priceCents: 399,
    name: { en: 'Hazelnut spread', it: 'Crema di nocciole' }, spokenName: { en: 'Hazelnut spread', it: 'Crema di nocciole' },
    brand: 'Ferrero', packSize: '400 g', spokenPack: { en: 'four hundred grams', it: 'quattrocento grammi' },
    allergens: ['milk', 'nuts'], vegan: false, vegetarian: true, lookAlikes: [],
  });
  expect(ProductSchema.parse(product)).toEqual(product);
});
it('takes the name of the language first, then the name with no language, then the name of the store', () => {
  const name = (part: Partial<ProductDetails['name']>) =>
    scannedProduct(nutella, { ...details, name: { en: null, it: null, any: null, ...part } }).name;
  expect(name({ any: 'Nutella spread' })).toEqual({ en: 'Nutella spread', it: 'Nutella spread' });
  expect(name({ it: 'Crema', any: 'Spread' })).toEqual({ en: 'Spread', it: 'Crema' });
  expect(name({ en: 'Spread' })).toEqual({ en: 'Spread', it: 'Nutella' });
  expect(name({})).toEqual({ en: 'Nutella', it: 'Nutella' });
});
it('with no details the product has the data of the store and no allergen data', () => {
  const product = scannedProduct(nutella, null);
  expect(product).toMatchObject({ name: { en: 'Nutella', it: 'Nutella' }, brand: 'Ferrero', allergens: null, vegan: null, vegetarian: null });
  expect(ProductSchema.safeParse(product).success).toBe(true);
});
it('fills the brand and the pack size that the store does not give', () => {
  const bare: StoreItem = { gtin: NUTELLA, priceCents: 399, name: 'Nutella' };
  expect(scannedProduct(bare, details)).toMatchObject({ brand: 'Ferrero SpA', packSize: '0.4 kg' });
  const alone = scannedProduct(bare, null);
  expect(alone).toMatchObject({ brand: 'Nutella', packSize: '1 pc', spokenPack: { en: 'one pack', it: 'una confezione' } });
  expect(ProductSchema.safeParse(alone).success).toBe(true);
});
it('writes a pack size as words', () => {
  expect(spokenPack('500 g', 'en')).toBe('five hundred grams');
  expect(spokenPack('1 L', 'en')).toBe('one litre');
  expect(spokenPack('1 l', 'it')).toBe('un litro');
  expect(spokenPack('330 ml', 'it')).toBe('trecentotrenta millilitri');
  expect(spokenPack('33cl', 'en')).toBe('thirty-three centilitres');
  expect(spokenPack('1 kg', 'it')).toBe('un chilo');
  expect(spokenPack('2 kg', 'en')).toBe('two kilograms');
  expect(spokenPack('1.5 L', 'en')).toBe('one point five litres');
  expect(spokenPack('1,5 l', 'it')).toBe('uno virgola cinque litri');
  expect(spokenPack('6 x 33 cl', 'en')).toBe('6 x 33 cl');
  expect(spokenPack('12000 g', 'en')).toBe('12000 g');
});

it('finds a scanned product by its ID beside the catalog, and lists only the catalog', () => {
  const index = withScanned(catalog, scanned);
  expect(index.get('gtin-3017624010701')).toBeUndefined();
  const product = scannedProduct(nutella, null);
  scanned.put(product);
  expect(index.get('gtin-3017624010701')).toEqual(product);
  expect(index.get('oat-drink-1l')).toBe(catalog.get('oat-drink-1l'));
  expect(index.products).toEqual(catalog.products);
});

it('a catalog product with the code wins, with its own price and texts', async () => {
  expect(await resolver().resolve(BARISTA)).toBe(catalog.get('oat-drink-barista-1l'));
  expect(scanned.get(scannedProductId(BARISTA))).toBeUndefined();
});
it('resolves a store item with the details of the database, and keeps the product', async () => {
  const product = await resolver().resolve(NUTELLA);
  expect(product).toMatchObject({
    id: 'gtin-3017624010701', priceCents: 399, name: { en: 'Nutella', it: 'Nutella' }, allergens: ['soy', 'milk', 'nuts'],
  });
  expect(scanned.get('gtin-3017624010701')).toEqual(product);
});
it('gives null for a code that the store list does not hold, and asks no database', async () => {
  const info = { byGtin: vi.fn<ProductInfo['byGtin']>(async () => details) };
  expect(await resolver({ info }).resolve('4006381333931')).toBeNull();
  expect(info.byGtin).not.toHaveBeenCalled();
});
it('uses the name of the store when the database fails', async () => {
  const info: ProductInfo = { byGtin: async () => { throw new Error('Open Food Facts answered 503.'); } };
  expect(await resolver({ info }).resolve(NUTELLA)).toMatchObject({ name: { en: 'Nutella' }, priceCents: 399, allergens: null });
  expect(logLines.join('\n')).toMatch(/product info: no details. gtin=3017624010701 Open Food Facts answered 503/);
});
it('does not wait for the database longer than the budget', async () => {
  const product = await resolver({ info: { byGtin: () => never() }, budgetMs: 20 }).resolve(NUTELLA);
  expect(product).toMatchObject({ name: { en: 'Nutella' }, allergens: null });
  expect(logLines.join('\n')).toMatch(/product info: no details. gtin=3017624010701 no answer in 20 ms/);
});
it('a later resolve replaces the product that had no details', async () => {
  let down = true;
  const info: ProductInfo = { byGtin: async () => { if (down) throw new Error('down'); return details; } };
  const lookup = resolver({ info });
  await lookup.resolve(NUTELLA);
  down = false;
  await lookup.resolve(NUTELLA);
  expect(scanned.get('gtin-3017624010701')).toMatchObject({ name: { en: 'Hazelnut spread' }, allergens: ['milk', 'nuts'] });
});
it('rejects when the store list does not answer inside the budget, or fails', async () => {
  const slow: StoreList = { byGtin: () => never(), all: async () => [] };
  await expect(resolver({ storeList: slow, budgetMs: 20 }).resolve(NUTELLA)).rejects.toThrow(/store list.*20 ms/);
  const broken: StoreList = { byGtin: async () => { throw new Error('ERP is down'); }, all: async () => [] };
  await expect(resolver({ storeList: broken }).resolve(NUTELLA)).rejects.toThrow(/ERP is down/);
});
it('gives the store list and the database one budget together', async () => {
  const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
  const slowList: StoreList = { byGtin: async () => { await wait(60); return nutella; }, all: async () => [nutella] };
  const slowInfo: ProductInfo = { byGtin: async () => { await wait(60); return details; } };
  const product = await resolver({ storeList: slowList, info: slowInfo, budgetMs: 90 }).resolve(NUTELLA);
  expect(product?.allergens).toBeNull();
});
it('builds each scanned product of the dev store list as a valid product', async () => {
  const lookup = resolver();
  for (const item of await storeList.all()) {
    const product = await lookup.resolve(item.gtin);
    expect(ProductSchema.safeParse(product).success).toBe(true);
    expect(product!.priceCents).toBe(item.priceCents);
  }
});
