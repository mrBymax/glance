import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { checkCatalog, reportLines } from './check';

type Entry = Record<string, unknown> & { id: string };

const dev = JSON.parse(readFileSync('catalog/catalog.dev.json', 'utf8')) as Entry[];

/** A copy of the dev catalog with one entry changed. */
function edit(id: string, patch: Record<string, unknown>): Entry[] {
  return dev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
}

it('accepts the dev catalog with two warnings', () => {
  const report = checkCatalog(dev);
  expect(report.errors).toEqual([]);
  expect(report.warnings).toEqual(['potato-crisps: no allergen data', 'catalog: 4 products, the demo needs 12']);
  expect(report.products).toHaveLength(4);
});
it('reports an input that is no array', () => {
  const report = checkCatalog({ products: dev });
  expect(report.errors).toEqual(['catalog: the input must be a JSON array of products']);
  expect(report.products).toEqual([]);
});
it('reports a duplicate ID, a bad ID, and a price of zero', () => {
  expect(checkCatalog([...dev, dev[2]]).errors).toContain('rye-bread: duplicate id');
  expect(checkCatalog(edit('rye-bread', { id: 'Rye_Bread' })).errors[0]).toMatch(/^Rye_Bread: id/);
  expect(checkCatalog(edit('rye-bread', { priceCents: 0 })).errors).toContain('rye-bread: priceCents is 0');
});
it('names an entry with no ID by its index, and keeps the entries that pass', () => {
  const { id: _id, ...noId } = dev[2]!;
  const report = checkCatalog([dev[0], dev[1], noId, dev[3]]);
  expect(report.errors).toHaveLength(1);
  expect(report.errors[0]).toMatch(/^entry 2: id /);
  expect(report.products.map((product) => product.id)).toEqual(['oat-drink-1l', 'oat-drink-barista-1l', 'potato-crisps']);
});
it('reports each field of an entry that fails the schema', () => {
  const errors = checkCatalog(edit('rye-bread', { priceCents: 2.5, brand: '' })).errors;
  expect(errors.filter((error) => error.startsWith('rye-bread: priceCents '))).toHaveLength(1);
  expect(errors.filter((error) => error.startsWith('rye-bread: brand '))).toHaveLength(1);
});
it('reports a look-alike that does not exist or does not point back', () => {
  expect(checkCatalog(edit('rye-bread', { lookAlikes: ['no-such'] })).errors).toContain('rye-bread: look-alike no-such does not exist');
  expect(checkCatalog(edit('oat-drink-barista-1l', { lookAlikes: [] })).errors)
    .toContain('oat-drink-1l: look-alike oat-drink-barista-1l does not list it back');
});
it('reports a product that lists itself as a look-alike', () => {
  expect(checkCatalog(edit('rye-bread', { lookAlikes: ['rye-bread'] })).errors)
    .toEqual(['rye-bread: look-alike rye-bread is the product itself']);
});
it('needs one look-alike pair that differs in price or allergens', () => {
  expect(checkCatalog(edit('oat-drink-barista-1l', { priceCents: 189 })).errors)
    .toContain('catalog: no look-alike pair differs in price or allergens');
  expect(checkCatalog(edit('oat-drink-barista-1l', { priceCents: 189, allergens: ['gluten', 'soy'] })).errors).toEqual([]);
  expect(checkCatalog([dev[2], dev[3]]).errors).toEqual(['catalog: no look-alike pair differs in price or allergens']);
});
it('does not count missing allergen data as a difference', () => {
  expect(checkCatalog(edit('oat-drink-barista-1l', { priceCents: 189, allergens: null })).errors)
    .toEqual(['catalog: no look-alike pair differs in price or allergens']);
});
it('checks the GTIN', () => {
  const errors = (gtin: string) => checkCatalog(edit('oat-drink-1l', { gtin })).errors;
  expect(errors('4006381333931')).toEqual([]);
  expect(errors('73513537')).toEqual([]);
  expect(errors('036000291452')).toEqual([]);
  expect(errors('00012345600012')).toEqual([]);
  expect(errors('4006381333932')).toEqual(['oat-drink-1l: gtin has a wrong check digit']);
  expect(errors('12345')).toEqual(['oat-drink-1l: gtin must have 8, 12, 13, or 14 digits']);
  expect(errors('40063813339 1')).toEqual(['oat-drink-1l: gtin must have 8, 12, 13, or 14 digits']);
});
it('with the Italian option, each spoken field needs Italian text', () => {
  const errors = checkCatalog(dev, { lang: 'it' }).errors;
  expect(errors).toContain('rye-bread: name has no Italian text');
  expect(errors).toContain('rye-bread: spokenPackDetailed has no Italian text');
  expect(errors.filter((error) => error.startsWith('oat-drink-1l:'))).toEqual([]);
  expect(checkCatalog(dev, { lang: 'en' }).errors).toEqual([]);
});
it('warns about a visual text that the prompt cannot use', () => {
  expect(checkCatalog(edit('rye-bread', { visual: 'Brown bag.' })).warnings).toContain('rye-bread: visual is too short for the prompt');
  for (const visual of ['Clear plastic bag | brown label, dark bread.', 'Clear plastic bag,\nbrown label, dark bread.']) {
    expect(checkCatalog(edit('rye-bread', { visual })).warnings).toContain('rye-bread: visual must be one line with no vertical bar');
  }
});
it('prints each error, each warning, and the counts', () => {
  expect(reportLines(checkCatalog(dev))).toEqual([
    'warning: potato-crisps: no allergen data',
    'warning: catalog: 4 products, the demo needs 12',
    'catalog: 4 products, 0 errors, 2 warnings',
  ]);
  expect(reportLines(checkCatalog([dev[2]])).at(-1)).toBe('catalog: 1 product, 1 error, 1 warning');
});
it('gives no count warning for 12 products', () => {
  const more = Array.from({ length: 8 }, (_, index) => ({ ...dev[2], id: `rye-bread-${index}` }));
  expect(checkCatalog([...dev, ...more]).warnings).toEqual(['potato-crisps: no allergen data']);
});
