import { expect, it } from 'vitest';
import type { StoreEntry } from '../products/storeEntries';
import { type SearchQuery, createProductSearch, pickOne } from './productSearch';

const NO_DETAILS = { quantity: null, allergens: null, vegan: null, vegetarian: null };
const entries: StoreEntry[] = [
  { item: { gtin: '5999571058020', priceCents: 149, name: 'Hell Classic Zero Sugarfree', brand: 'Hell', packSize: '250 ml' }, details: null },
  {
    item: { gtin: '6430062761764', priceCents: 249, name: 'Kili Cascara Vadelma', brand: 'Kili', packSize: '330 ml' },
    details: { ...NO_DETAILS, brand: 'Jaffa Roastery Oy', texts: { names: ['Kili Cascara + Vadelma'], brands: ['Jaffa Roastery Oy'], keywords: ['cascara', 'jaffa', 'kili', 'vadelma'] } },
  },
  { item: { gtin: '6430062761795', priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' }, details: null },
  { item: { gtin: '6430062761825', priceCents: 249, name: 'Kili Cascara Mango + Ananas', brand: 'Kili', packSize: '330 ml' }, details: null },
  {
    item: { gtin: '6416453073494', priceCents: 199, name: 'Paper cups' },
    details: { ...NO_DETAILS, brand: 'Pirkka', texts: { names: ['Kartonkipikari', 'Pappersmugg', 'Paper cups'], brands: ['Pirkka'], keywords: ['kartonkipikari', 'pappersmugg'] } },
  },
  { item: { gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5', brand: 'Barilla', packSize: '500 g' }, details: null },
  { item: { gtin: '8076809513753', priceCents: 289, name: 'Pesto alla genovese', brand: 'Barilla', packSize: '190 g' }, details: null },
];
const search = createProductSearch(entries);
const find = (query: SearchQuery, limit = 5) => search.search(query, limit);
const gtins = async (query: SearchQuery) => (await find(query)).map((candidate) => candidate.gtin);

it('ranks the item of the brand and the flavor word first among items of one design', async () => {
  const found = await find({ brand: 'Kili', variant: 'Vadelma' });
  expect(found[0]!.gtin).toBe('6430062761764');
  expect(found.map((candidate) => candidate.gtin).sort()).toEqual(['6430062761764', '6430062761795', '6430062761825']);
  expect(found[0]!.score).toBeGreaterThan(found[1]!.score);
  expect(found[1]!.score).toBe(found[2]!.score);
});
it('names the fields that matched', async () => {
  const [first] = await find({ brand: 'kili', name: 'Cascara', variant: 'Yuzu + Sitruuna', size: '0,33 l' });
  expect(first!.gtin).toBe('6430062761795');
  expect(first!.reasons).toEqual(['brand: kili', 'name: cascara, yuzu, sitruuna', 'size: 330ml']);
});
it('words that each item of the brand shares do not select an item', async () => {
  const found = await find({ brand: 'Kili', name: 'Cascara' });
  expect(new Set(found.map((candidate) => candidate.score)).size).toBe(1);
  expect(pickOne(found)).toBeNull();
});
it('selects one item by the brand and its own word', async () => {
  expect(pickOne(await find({ brand: 'Kili', variant: 'Vadelma' }))?.gtin).toBe('6430062761764');
  expect(pickOne(await find({ brand: 'KILI', name: 'CASCARA MANGO ANANAS' }))?.gtin).toBe('6430062761825');
  expect(pickOne(await find({ brand: 'Barilla', name: 'Spaghetti n.5', size: '500g' }))?.gtin).toBe('8076800195057');
});
it('selects no item by its own word alone, with no brand', async () => {
  const found = await find({ variant: 'Vadelma' });
  expect(found[0]!.gtin).toBe('6430062761764');
  expect(pickOne(found)).toBeNull();
});
it('selects no item by the brand alone', async () => {
  expect(pickOne(await find({ brand: 'Hell' }))).toBeNull();
  expect((await find({ brand: 'Hell' }))[0]!.gtin).toBe('5999571058020');
});
it('finds an item by a name in another language, from the product database', async () => {
  expect(await gtins({ name: 'Kartonkipikari / Pappersmugg' })).toEqual(['6416453073494']);
  expect(pickOne(await find({ brand: 'Pirkka', name: 'Kartonkipikari' }))?.gtin).toBe('6416453073494');
});
it('finds an item by a brand that only the product database has', async () => {
  expect(await gtins({ brand: 'Jaffa Roastery' })).toEqual(['6430062761764']);
});
it('matches a word that is cut off or has one wrong letter, with a lower score', async () => {
  const exact = (await find({ brand: 'Kili', variant: 'Vadelma' }))[0]!;
  const cut = (await find({ brand: 'Kili', variant: 'Vadelm' }))[0]!;
  expect(cut.gtin).toBe('6430062761764');
  expect(cut.score).toBeLessThan(exact.score);
});
it('a size of another item counts against it', async () => {
  const found = await find({ brand: 'Kili', variant: 'Vadelma', size: '250 ml' });
  expect(found[0]!.gtin).toBe('6430062761764');
  expect(pickOne(found)).toBeNull();
});
it('finds an item by other words of the package', async () => {
  expect(await gtins({ texts: ['genovese', 'basilico'] })).toEqual(['8076809513753']);
});
it('gives no candidate for words that no item has', async () => {
  expect(await find({ brand: 'Oatly', name: 'Barista' })).toEqual([]);
  expect(await find({})).toEqual([]);
  expect(pickOne([])).toBeNull();
});
it('takes digits with a right check digit that the store list holds, at once', async () => {
  const found = await find({ digits: ['6430062761795'], brand: 'Hell' });
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ gtin: '6430062761795', score: 1, reasons: ['code: 6430062761795'] });
  expect(pickOne(found)?.gtin).toBe('6430062761795');
});
it('drops digits with a wrong check digit, digits of no item, and two codes of two items', async () => {
  expect(await find({ digits: ['6430062761796'] })).toEqual([]);
  expect(await find({ digits: ['4006381333931'] })).toEqual([]);
  expect(await find({ digits: ['6430062761795', '5999571058020'] })).toEqual([]);
});
it('takes a plain text as the words of a package', async () => {
  expect((await search.search('kili vadelma', 2)).map((candidate) => candidate.gtin)[0]).toBe('6430062761764');
  expect(await search.search('raspberry soda', 2)).toEqual([]);
});
it('returns at most the limit', async () => {
  expect(await find({ brand: 'Kili' }, 2)).toHaveLength(2);
});
it('gives the item of a code', async () => {
  expect((await search.get('6430062761764'))?.item.name).toBe('Kili Cascara Vadelma');
  expect(await search.get('4006381333931')).toBeUndefined();
});
it('scores from 0 to 1', async () => {
  for (const candidate of await find({ brand: 'Kili', name: 'Cascara', variant: 'Vadelma', size: '330 ml', texts: ['kahvimarja'] })) {
    expect(candidate.score).toBeGreaterThan(0);
    expect(candidate.score).toBeLessThanOrEqual(1);
  }
});
it('takes an item out with no restart, and the words of the items that are left weigh again', async () => {
  const index = createProductSearch(entries);
  const vadelma = '6430062761764';
  expect((await index.search({ brand: 'Kili', variant: 'Vadelma' }, 5))[0]!.gtin).toBe(vadelma);
  index.remove(vadelma);
  index.remove('4006381333931');
  expect(await index.get(vadelma)).toBeUndefined();
  expect((await index.search({ brand: 'Kili', variant: 'Vadelma' }, 5)).map((candidate) => candidate.gtin)).not.toContain(vadelma);
  expect(await index.search({ digits: [vadelma] }, 5)).toEqual([]);
});
it('takes a newer entry of an item, and a new item, with no restart', async () => {
  const index = createProductSearch(entries.slice(0, 4));
  expect(await index.search({ name: 'Kartonkipikari' }, 5)).toEqual([]);
  expect(await index.search({ brand: 'Jaffa' }, 5)).toHaveLength(1);
  index.put(entries[4]!);
  index.put({ item: entries[1]!.item, details: null });
  expect((await index.search({ name: 'Kartonkipikari' }, 5)).map((candidate) => candidate.gtin)).toEqual(['6416453073494']);
  expect(await index.search({ brand: 'Jaffa' }, 5)).toEqual([]);
  expect((await index.search({ brand: 'Kili', variant: 'Vadelma' }, 5))[0]!.gtin).toBe('6430062761764');
});
