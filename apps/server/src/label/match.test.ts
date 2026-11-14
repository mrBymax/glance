import { expect, it } from 'vitest';
import type { StoreItem } from '../products/storeList';
import { matchLabel } from './match';
import { type LabelAnswer, NO_LABEL, parseLabelAnswer } from './reader';

const items: StoreItem[] = [
  { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' },
  { gtin: '0000080177173', priceCents: 45, name: 'Nutella', brand: 'Ferrero', packSize: '15 g' },
  { gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5', brand: 'Barilla', packSize: '500 g' },
  { gtin: '8076809513753', priceCents: 289, name: 'Pesto alla genovese', brand: 'Barilla', packSize: '190 g' },
  { gtin: '8001250120120', priceCents: 159, name: 'Spaghetti n.12', brand: 'De Cecco', packSize: '500 g' },
  { gtin: '8002270014901', priceCents: 89, name: 'Acqua minerale', brand: 'San Pellegrino', packSize: '1 L' },
  { gtin: '2000000000015', priceCents: 150, name: 'Pane del forno' },
];
const read = (part: Partial<LabelAnswer>): LabelAnswer => ({ ...NO_LABEL, confidence: 0.9, ...part });
const match = (part: Partial<LabelAnswer>, minConfidence = 0.6) => matchLabel(read(part), items, minConfidence);

it('takes digits with a right check digit that the store list holds', () => {
  expect(match({ digits: ['8076800195057'] })).toBe('8076800195057');
  expect(match({ digits: ['8 076800 195057'] })).toBe('8076800195057');
  expect(match({ digits: ['80177173'] })).toBe('0000080177173');
  expect(match({ digits: ['L 23 11', '2000000000015'] })).toBe('2000000000015');
});
it('takes digits at each confidence, because the check digit and the store list test them', () => {
  expect(match({ digits: ['8076800195057'], confidence: 0 })).toBe('8076800195057');
});
it('drops digits with a wrong check digit, and digits that the store list does not hold', () => {
  expect(match({ digits: ['8076800195058'] })).toBeNull();
  expect(match({ digits: ['4006381333931'] })).toBeNull();
  expect(match({ digits: ['80768001950'] })).toBeNull();
});
it('gives no product for two codes of two items', () => {
  expect(match({ digits: ['8076800195057', '3017624010701'] })).toBeNull();
  expect(match({ digits: ['8076800195057', '8076800195057'] })).toBe('8076800195057');
});
it('a right code wins over the brand and the name', () => {
  expect(match({ digits: ['8076800195057'], brand: 'De Cecco', name: 'Spaghetti n.12' })).toBe('8076800195057');
});
it('matches one item by each word of its brand and half of the words of its name', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla Genovese' })).toBe('8076809513753');
  expect(match({ brand: 'BARILLA', name: 'pesto genovese con basilico' })).toBe('8076809513753');
  expect(match({ brand: 'De Cecco', name: 'Spaghetti n° 12' })).toBe('8001250120120');
  expect(match({ brand: null, name: 'San Pellegrino acqua minerale naturale' })).toBe('8002270014901');
});
it('compares with no case and no accent', () => {
  const accent: StoreItem[] = [{ gtin: '8002270014901', priceCents: 89, name: 'Tè al limone', brand: 'Estathé' }];
  expect(matchLabel(read({ brand: 'ESTATHE', name: 'Te al Limone' }), accent, 0.6)).toBe('8002270014901');
});
it('needs each word of the brand', () => {
  expect(match({ brand: 'Cecco', name: 'Spaghetti n.12' })).toBeNull();
  expect(match({ brand: 'Pellegrino', name: 'Acqua minerale' })).toBeNull();
});
it('needs half of the words of the name', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto rosso' })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Fusilli' })).toBeNull();
});
it('gives no product when two items match', () => {
  // "Spaghetti n.5" shares 2 of its 3 words with "Spaghetti n. 7".
  const two: StoreItem[] = [...items, { gtin: '8076800105056', priceCents: 109, name: 'Spaghetti n.7', brand: 'Barilla', packSize: '500 g' }];
  expect(matchLabel(read({ brand: 'Barilla', name: 'Spaghetti n.5' }), two, 0.6)).toBeNull();
});
it('the pack size selects between items with one brand and one name', () => {
  expect(match({ brand: 'Ferrero', name: 'Nutella' })).toBeNull();
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '400g' })).toBe('3017624010701');
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '15 G' })).toBe('0000080177173');
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '750 g' })).toBeNull();
});
it('never matches an item with no brand by its name', () => {
  expect(match({ brand: 'Forno', name: 'Pane del forno' })).toBeNull();
});
it('needs the confidence of recognition for a match by brand and name', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla genovese', confidence: 0.59 })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Pesto alla genovese', confidence: 0.6 })).toBe('8076809513753');
});
it('gives no product for an empty answer', () => {
  expect(match({})).toBeNull();
  expect(matchLabel(NO_LABEL, items, 0)).toBeNull();
});

it('reads the answer of the model, and an answer that is no label as an empty one', () => {
  const answer = { digits: ['8076800195057'], brand: 'Barilla', name: 'Spaghetti n.5', packSize: '500 g', confidence: 0.8 };
  expect(parseLabelAnswer(answer)).toEqual(answer);
  expect(parseLabelAnswer({ ...answer, brand: '  ', name: null })).toMatchObject({ brand: null, name: null });
  expect(parseLabelAnswer({ ...answer, confidence: 2 })).toEqual(NO_LABEL);
  expect(parseLabelAnswer({ digits: '8076800195057' })).toEqual(NO_LABEL);
  expect(parseLabelAnswer(undefined)).toEqual(NO_LABEL);
});
