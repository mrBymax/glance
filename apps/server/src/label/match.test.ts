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
const match = (part: Partial<LabelAnswer>, minConfidence = 0.6) => matchLabel(read(part), items, minConfidence, 0.7);

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
it('matches one item by each word of its brand and each word of its name', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla Genovese' })).toBe('8076809513753');
  expect(match({ brand: 'BARILLA', name: 'genovese pesto alla, con basilico fresco' })).toBe('8076809513753');
  expect(match({ brand: 'De Cecco', name: 'Spaghetti n° 12' })).toBe('8001250120120');
  expect(match({ brand: null, name: 'San Pellegrino acqua minerale naturale' })).toBe('8002270014901');
});
it('compares with no case and no accent', () => {
  const accent: StoreItem[] = [{ gtin: '8002270014901', priceCents: 89, name: 'Tè al limone', brand: 'Estathé' }];
  expect(matchLabel(read({ brand: 'ESTATHE', name: 'Te al Limone' }), accent, 0.6, 0.7)).toBe('8002270014901');
});
it('needs each word of the brand', () => {
  expect(match({ brand: 'Pellegrino', name: 'Acqua minerale' })).toBeNull();
  expect(match({ brand: 'De Cecco', name: 'Pesto alla genovese' })).toBeNull();
});
it('needs each word of the name, so another type of one product line gives no product', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla calabrese' })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Pesto genovese' })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Pesto rosso' })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Fusilli' })).toBeNull();
});
it('ignores the words of 1 or 2 letters of the brand and of the name', () => {
  expect(match({ brand: 'Cecco', name: 'Spaghetti 12' })).toBe('8001250120120');
  const short: StoreItem[] = [{ gtin: '8002270014901', priceCents: 89, name: 'Tè al limone', brand: 'Estathé' }];
  expect(matchLabel(read({ brand: 'Estathe', name: 'Limone' }), short, 0.6, 0.7)).toBe('8002270014901');
});
it('needs each word of a brand or a name that has only short words', () => {
  const short: StoreItem[] = [{ gtin: '8002270014901', priceCents: 89, name: 'Tè', brand: 'LU' }];
  expect(matchLabel(read({ brand: 'LU', name: 'Tè' }), short, 0.6, 0.7)).toBe('8002270014901');
  expect(matchLabel(read({ brand: 'LU', name: 'Biscotti' }), short, 0.6, 0.7)).toBeNull();
  expect(matchLabel(read({ brand: 'Bahlsen', name: 'Tè' }), short, 0.6, 0.7)).toBeNull();
});
it('reads the words also in the pack size of the answer', () => {
  const passata: StoreItem[] = [{ gtin: '8002270014901', priceCents: 129, name: 'Passata 700 g', brand: 'Mutti' }];
  expect(matchLabel(read({ brand: 'Mutti', name: 'Passata' }), passata, 0.6, 0.7)).toBeNull();
  expect(matchLabel(read({ brand: 'Mutti', name: 'Passata', packSize: '700 g' }), passata, 0.6, 0.7)).toBe('8002270014901');
});
it('gives no product when two items match', () => {
  // The answer holds each word of both names.
  const two: StoreItem[] = [...items, { gtin: '8076809523509', priceCents: 289, name: 'Pesto', brand: 'Barilla', packSize: '190 g' }];
  expect(matchLabel(read({ brand: 'Barilla', name: 'Pesto alla genovese' }), two, 0.6, 0.7)).toBeNull();
  expect(matchLabel(read({ brand: 'Barilla', name: 'Pesto alla genovese', packSize: '190 g' }), two, 0.6, 0.7)).toBeNull();
});
it('needs each number of the name of the item, so another size or type of one product line gives no product', () => {
  expect(match({ brand: 'Barilla', name: 'Spaghetti n.3' })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Spaghetti' })).toBeNull();
  expect(match({ brand: 'De Cecco', name: 'Spaghetti n.1' })).toBeNull();
  const two: StoreItem[] = [...items, { gtin: '8076800105056', priceCents: 109, name: 'Spaghetti n.7', brand: 'Barilla', packSize: '500 g' }];
  expect(matchLabel(read({ brand: 'Barilla', name: 'Spaghetti n.5' }), two, 0.6, 0.7)).toBe('8076800195057');
});
it('the pack size selects between items with one brand and one name', () => {
  expect(match({ brand: 'Ferrero', name: 'Nutella' })).toBeNull();
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '400g' })).toBe('3017624010701');
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '15 G' })).toBe('0000080177173');
  expect(match({ brand: 'Ferrero', name: 'Nutella', packSize: '750 g' })).toBeNull();
});
it('matches an item with no brand by each word of its name', () => {
  expect(match({ brand: 'Forno', name: 'Pane del forno' })).toBe('2000000000015');
  expect(match({ brand: 'Biscoff', name: 'you gotta love' }, 0.6)).toBeNull();
  const withBiscoff = [...items, { gtin: '7312220096019', priceCents: 279, name: 'Biscoff' }];
  expect(matchLabel(read({ brand: 'Biscoff', name: 'you gotta love' }), withBiscoff, 0.6, 0.7)).toBe('7312220096019');
  expect(match({ brand: 'Forno', name: 'Pane' })).toBeNull();
});
it('needs the confidence of recognition for a match by brand and name', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla genovese', confidence: 0.59 })).toBeNull();
  expect(match({ brand: 'Barilla', name: 'Pesto alla genovese', confidence: 0.6 })).toBe('8076809513753');
});

const PAPER_CUPS = '6438574558384';
const demo: StoreItem[] = [...items, { gtin: PAPER_CUPS, priceCents: 349, name: 'Paper cups' }];
/** The still of the test with the glasses: the package text is Finnish and Swedish, and the printed code is not the code of the list. */
const cups = (part: Partial<LabelAnswer>) => matchLabel(
  read({ digits: ['6414761011559'], name: 'KARTONKIPIKARI PAPPERSMUGG', item: PAPER_CUPS, itemConfidence: 0.9, ...part }), demo, 0.6, 0.7,
);

it('takes the item that the model chose when the words of the package are in another language', () => {
  expect(cups({})).toBe(PAPER_CUPS);
  expect(cups({ item: null, itemConfidence: 0 })).toBeNull();
});
it('needs the item confidence of the settings for the item of the model', () => {
  expect(cups({ itemConfidence: 0.7 })).toBe(PAPER_CUPS);
  expect(cups({ itemConfidence: 0.69 })).toBeNull();
});
it('takes the item of the model at each confidence of the brand and the name', () => {
  expect(cups({ confidence: 0 })).toBe(PAPER_CUPS);
});
it('drops an item of the model that the store list does not hold', () => {
  expect(cups({ item: '4006381333931' })).toBeNull();
  expect(cups({ item: 'paper-cups' })).toBeNull();
});
it('gives no product when the digits and the item of the model name two items', () => {
  expect(cups({ digits: ['8076800195057'] })).toBeNull();
  expect(cups({ digits: [PAPER_CUPS] })).toBe(PAPER_CUPS);
});
it('digits of a store item win over an item of the model with a low confidence', () => {
  expect(cups({ digits: ['8076800195057'], itemConfidence: 0.5 })).toBe('8076800195057');
});
it('falls back to the words when the model chose no item', () => {
  expect(match({ brand: 'Barilla', name: 'Pesto alla Genovese', item: null })).toBe('8076809513753');
  expect(match({ brand: 'Barilla', name: 'Pesto alla Genovese', item: '8001250120120', itemConfidence: 0.2 })).toBe('8076809513753');
});
it('gives no product for an empty answer', () => {
  expect(match({})).toBeNull();
  expect(matchLabel(NO_LABEL, items, 0, 0)).toBeNull();
});

it('reads the answer of the model, and an answer that is no label as an empty one', () => {
  const answer = {
    digits: ['8076800195057'], brand: 'Barilla', name: 'Spaghetti n.5', packSize: '500 g', confidence: 0.8,
    item: '8076800195057', itemConfidence: 0.9,
  };
  expect(parseLabelAnswer(answer)).toEqual(answer);
  // A fake script from before the field `item` has none.
  const { item: _item, itemConfidence: _itemConfidence, ...old } = answer;
  expect(parseLabelAnswer(old)).toEqual({ ...old, item: null, itemConfidence: 0 });
  expect(parseLabelAnswer({ ...answer, itemConfidence: 1.5 })).toEqual(NO_LABEL);
  expect(parseLabelAnswer({ ...answer, brand: '  ', name: null })).toMatchObject({ brand: null, name: null });
  expect(parseLabelAnswer({ ...answer, confidence: 2 })).toEqual(NO_LABEL);
  expect(parseLabelAnswer({ digits: '8076800195057' })).toEqual(NO_LABEL);
  expect(parseLabelAnswer(undefined)).toEqual(NO_LABEL);
});
it('the pack size never selects an item that has no pack size', () => {
  const two: StoreItem[] = [
    { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' },
    { gtin: '0000080177173', priceCents: 45, name: 'Nutella', brand: 'Ferrero' },
  ];
  expect(matchLabel(read({ brand: 'Ferrero', name: 'Nutella', packSize: '15 g' }), two, 0.6, 0.7)).toBeNull();
  expect(matchLabel(read({ brand: 'Ferrero', name: 'Nutella', packSize: '400 g' }), two, 0.6, 0.7)).toBe('3017624010701');
});
it('tells three drinks of one brand apart by the flavor word, and a plus sign in a name is no word', () => {
  const kili: StoreItem[] = [
    { gtin: '6430062761764', priceCents: 249, name: 'Kili Cascara Vadelma', brand: 'Kili', packSize: '330 ml' },
    { gtin: '6430062761795', priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' },
    { gtin: '6430062761825', priceCents: 249, name: 'Kili Cascara Mango + Ananas', brand: 'Kili', packSize: '330 ml' },
  ];
  const kiliMatch = (name: string) => matchLabel(read({ brand: 'Kili', name, packSize: '330 ml' }), kili, 0.6, 0.7);
  expect(kiliMatch('Cascara Yuzu + Sitruuna')).toBe('6430062761795');
  expect(kiliMatch('CASCARA yuzu sitruuna')).toBe('6430062761795');
  expect(kiliMatch('Cascara Mango & Ananas')).toBe('6430062761825');
  expect(kiliMatch('Cascara vadelma')).toBe('6430062761764');
  // The flavor is not read, so the three items stay three.
  expect(kiliMatch('Cascara')).toBeNull();
  expect(kiliMatch('Cascara Yuzu')).toBeNull();
});
