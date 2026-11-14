import { LANGS } from '@glance/shared';
import { expect, it } from 'vitest';
import { EN, IT, LANGUAGE_NAMES, stringsFor } from './strings';

type Node = string | ((...args: never[]) => string) | { [key: string]: Node };
type Entry = [key: string, text: string];

/** Returns each text of a string table. A function gets the same sample value for each argument. */
function texts(node: Node, path: string, sample: number): Entry[] {
  if (typeof node === 'string') return [[path, node]];
  if (typeof node === 'function') return [[path, (node as (...values: number[]) => string)(sample, sample, sample)]];
  return Object.entries(node).flatMap(([key, child]) => texts(child, path ? `${path}.${key}` : key, sample));
}

/** Each text with the sample 1, then each text with the sample 3, because a count changes a word. */
function allTexts(table: Node): Entry[] {
  return [...texts(table, '', 1), ...texts(table, '', 3).map(([key, text]): Entry => [`${key}#3`, text])];
}

// These texts are equal in both languages: a name, a loan word, or a pattern with no word.
const SAME = new Set(['appTitle', 'cartLine', 'standard', 'privacyTitle', 'candidate', 'budget', 'status.percent', 'status.online', 'status.offline']);

it('selects the table of the language', () => {
  expect(stringsFor('en')).toBe(EN);
  expect(stringsFor('it')).toBe(IT);
  expect(Object.keys(LANGUAGE_NAMES)).toEqual([...LANGS]);
});
it('has an Italian text for each English text, and four fixed words', () => {
  const english = new Map(allTexts(EN));
  const italian = allTexts(IT);
  expect(italian.map(([key]) => key)).toEqual([...english.keys()]);
  const untranslated = italian.filter(([key, text]) => text === english.get(key) && !SAME.has(key.replace('#3', '')));
  expect(untranslated).toEqual([]);
  expect([IT.add, IT.skip, IT.pay, IT.settings]).toEqual(['Aggiungi', 'Salta', 'Paga', 'Impostazioni']);
});
it('follows the copy rules in both languages', () => {
  for (const [key, text] of [...allTexts(EN), ...allTexts(IT)]) {
    expect(text, key).not.toMatch(/[!;—]|\p{Extended_Pictographic}/u);
    for (const sentence of text.split(/(?<=\.)\s/)) expect(sentence.split(/\s+/).length, key).toBeLessThanOrEqual(25);
  }
});
it('counts one item and several items in Italian', () => {
  expect(IT.items(1)).toBe('1 articolo');
  expect(IT.items(3)).toBe('3 articoli');
  expect(IT.cartStatus(0, '0.00 EUR')).toBe('Carrello: vuoto.');
  expect(IT.cartStatus(2, '4.49 EUR')).toBe('Carrello: 2 articoli, 4.49 EUR.');
});
