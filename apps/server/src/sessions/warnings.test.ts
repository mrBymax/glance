import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { DEFAULT_PROFILE as P, type Product } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { CRISPS, OAT, harness } from './harness';
import { toSnapshot } from './view';
import { warningsFor } from './warnings';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const oat = catalog.get(OAT)!;
const crisps = catalog.get(CRISPS)!;

it('warns for each allergen that the profile lists and the product holds', () => {
  expect(warningsFor(oat, { ...P, allergens: ['milk', 'gluten'] })).toEqual([{ kind: 'allergen', allergens: ['gluten'] }]);
  expect(warningsFor(oat, { ...P, allergens: ['milk'] })).toEqual([]);
});
it('lists the allergens in the order of the profile', () => {
  const mix: Product = { ...oat, allergens: ['gluten', 'soy', 'nuts'] };
  expect(warningsFor(mix, { ...P, allergens: ['nuts', 'milk', 'gluten'] })).toEqual([{ kind: 'allergen', allergens: ['nuts', 'gluten'] }]);
});
it('reports missing data one time', () => {
  expect(warningsFor(crisps, { ...P, allergens: ['gluten'] })).toEqual([{ kind: 'allergenDataMissing' }]);
  expect(warningsFor(crisps, { ...P, allergens: ['gluten'], vegan: true })).toEqual([{ kind: 'allergenDataMissing' }]);
  expect(warningsFor(crisps, { ...P, vegan: true, vegetarian: true })).toEqual([{ kind: 'allergenDataMissing' }]);
});
it('warns for a diet', () => {
  const meat = { ...oat, vegan: false, vegetarian: false };
  expect(warningsFor(meat, { ...P, vegan: true, vegetarian: true })).toEqual([{ kind: 'diet', diet: 'vegan' }]);
  expect(warningsFor(meat, { ...P, vegetarian: true })).toEqual([{ kind: 'diet', diet: 'vegetarian' }]);
});
it('puts the allergen warning before the diet warning', () => {
  const cheese = { ...oat, allergens: ['milk' as const], vegan: false };
  expect(warningsFor(cheese, { ...P, allergens: ['milk'], vegan: true }))
    .toEqual([{ kind: 'allergen', allergens: ['milk'] }, { kind: 'diet', diet: 'vegan' }]);
});
it('gives no warning to a profile with no allergen and no diet', () => {
  expect(warningsFor(crisps, P)).toEqual([]);
});
it('puts the warning in the event, the line, and the sound', () => {
  const h = harness({ profile: { allergens: ['gluten'] } });
  h.see(OAT);
  const warnings = [{ kind: 'allergen', allergens: ['gluten'] }];
  expect(h.event('glance.pending')!.warnings).toEqual(warnings);
  expect(h.speak()).toMatchObject({ line: { warnings }, sound: 'warning' });
});
it('puts the warning in the prompt for a product in the cart', () => {
  const h = harness({ profile: { allergens: ['gluten'] }, cart: [OAT] });
  h.see(OAT);
  const warnings = [{ kind: 'allergen', allergens: ['gluten'] }];
  expect(h.event('glance.pending')).toMatchObject({ kind: 'inCart', warnings });
  expect(h.speak()).toMatchObject({ line: { key: 'glance.inCart', warnings }, sound: 'warning' });
});
it('gives a glance with no warning no sound', () => {
  const h = harness({ profile: { allergens: ['milk'] } });
  h.see(OAT);
  expect(h.event('glance.pending')!.warnings).toEqual([]);
  expect(h.speak()).toMatchObject({ line: { warnings: [] }, sound: null });
});
it('puts the warnings of the current prompt in the snapshot', () => {
  const h = harness({ profile: { allergens: ['gluten'] } });
  h.see(CRISPS);
  expect(toSnapshot('s-1', h.state, [], h.ctx).prompt).toMatchObject({ kind: 'product', warnings: [{ kind: 'allergenDataMissing' }] });
});
