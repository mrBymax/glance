import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { EU_ALLERGENS } from '@glance/shared';
import { FAKE_PRODUCT_INFO_DIR, createFakeProductInfo } from './fakeProductInfo';
import { OFF_ALLERGEN_TAGS, parseOffAnswer } from './productInfo';

const answer = (product: object) => ({ code: '1', product, status: 1, status_verbose: 'product found' });
const fixture = (gtin: string): unknown => JSON.parse(readFileSync(`${FAKE_PRODUCT_INFO_DIR}/${gtin}.json`, 'utf8'));

it('reads the fields of a product', () => {
  expect(parseOffAnswer(fixture('8076800195057'))).toEqual({
    name: { en: 'Spaghetti Nº5', it: 'Spaghetti n.5', any: 'Spaghetti Nº5' },
    brand: 'Barilla',
    quantity: '500 g',
    allergens: ['gluten', 'eggs', 'soy', 'mustard'],
    vegan: null,
    vegetarian: true,
  });
});
it('maps each of the 14 allergens, in the order of the contract', () => {
  expect(Object.values(OFF_ALLERGEN_TAGS).sort()).toEqual([...EU_ALLERGENS].sort());
  const all = parseOffAnswer(answer({ allergens_tags: Object.keys(OFF_ALLERGEN_TAGS).reverse() }));
  expect(all?.allergens).toEqual([...EU_ALLERGENS]);
});
it('adds the traces to the allergens, and counts each one time', () => {
  const details = parseOffAnswer(answer({ allergens_tags: ['en:nuts'], traces_tags: ['en:milk', 'en:nuts', 'en:soybeans'] }));
  expect(details?.allergens).toEqual(['soy', 'milk', 'nuts']);
});
it('reads an empty allergen list as no data, also with traces', () => {
  expect(parseOffAnswer(answer({ allergens_tags: [], traces_tags: [] }))?.allergens).toBeNull();
  expect(parseOffAnswer(answer({}))?.allergens).toBeNull();
  // Wheat pasta with no allergen in the database: the traces alone would read as "no gluten".
  expect(parseOffAnswer(fixture('8001250120120'))?.allergens).toBeNull();
  expect(parseOffAnswer(answer({ allergens_tags: ['en:kiwi', 'en:none'], traces_tags: ['en:milk'] }))?.allergens).toBeNull();
});
it('reads vegan and vegetarian only from a sure tag', () => {
  const diet = (tags: string[]) => {
    const details = parseOffAnswer(answer({ ingredients_analysis_tags: tags }))!;
    return [details.vegan, details.vegetarian];
  };
  expect(diet(['en:vegan', 'en:vegetarian'])).toEqual([true, true]);
  expect(diet(['en:non-vegan', 'en:vegetarian'])).toEqual([false, true]);
  expect(diet(['en:non-vegan', 'en:non-vegetarian'])).toEqual([false, false]);
  expect(diet(['en:maybe-vegan', 'en:maybe-vegetarian'])).toEqual([null, null]);
  expect(diet(['en:vegan-status-unknown', 'en:vegetarian-status-unknown'])).toEqual([null, null]);
  expect(diet([])).toEqual([null, null]);
  // Two tags that disagree are no data.
  expect(diet(['en:vegan', 'en:non-vegan'])).toEqual([null, null]);
});
it('reads a missing or empty name as null, and removes extra spaces', () => {
  expect(parseOffAnswer(fixture('3017624010701'))?.name).toEqual({ en: 'Nutella', it: null, any: 'Nutella' });
  expect(parseOffAnswer(answer({ product_name: '  Acqua   minerale ', product_name_en: 7 }))?.name)
    .toEqual({ en: null, it: null, any: 'Acqua minerale' });
});
it('takes the first brand, and writes the quantity with a space and no ".0"', () => {
  expect(parseOffAnswer(fixture('3017624010701'))).toMatchObject({ brand: 'Ferrero', quantity: '400 g' });
  expect(parseOffAnswer(fixture('8001250120120'))?.quantity).toBe('500 g');
  expect(parseOffAnswer(answer({ brands: ' , ', quantity: '6 x 33 cl' }))).toMatchObject({ brand: null, quantity: '6 x 33 cl' });
  expect(parseOffAnswer(answer({ brands: ['Barilla'], quantity: 500 }))).toMatchObject({ brand: null, quantity: null });
});
it('reads a field of the wrong type as no data and keeps the other fields', () => {
  const details = parseOffAnswer(answer({ product_name: 'Tè', allergens_tags: 'en:milk', traces_tags: [3, 'en:eggs'], ingredients_analysis_tags: null }));
  expect(details).toEqual({ name: { en: null, it: null, any: 'Tè' }, brand: null, quantity: null, allergens: null, vegan: null, vegetarian: null });
});
it('reads an answer with the status 0, or with no product, as not found', () => {
  expect(parseOffAnswer({ code: '2999999999990', status: 0, status_verbose: 'product not found' })).toBeNull();
  expect(parseOffAnswer({ status: 1 })).toBeNull();
  expect(parseOffAnswer({ status: 0, product: { product_name: 'Left over' } })).toBeNull();
  expect(parseOffAnswer('not found')).toBeNull();
  expect(parseOffAnswer(null)).toBeNull();
});

it('the fake reader reads a fixture by the 13 digits and makes no call', async () => {
  const info = createFakeProductInfo();
  expect(await info.byGtin('0000080177173')).toMatchObject({ name: { en: 'Nutella' }, quantity: '15 g', vegan: false });
  expect(await info.byGtin('5449000000996')).toMatchObject({ brand: 'COCA-COLA SERVICES SA/NV', allergens: null });
});
it('the fake reader knows no other code', async () => {
  expect(await createFakeProductInfo().byGtin('4006381333931')).toBeNull();
  expect(await createFakeProductInfo().byGtin('../../package')).toBeNull();
});
it('each item of the dev store list has a fixture', async () => {
  const { DEFAULT_STORE_LIST_PATH, readStoreListFile } = await import('./storeList');
  const info = createFakeProductInfo();
  for (const item of await readStoreListFile(DEFAULT_STORE_LIST_PATH).all()) expect(await info.byGtin(item.gtin)).not.toBeNull();
});
