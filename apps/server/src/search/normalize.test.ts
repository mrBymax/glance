import { expect, it } from 'vitest';
import { sizeKey, wordMatch, wordsOf } from './normalize';

it('splits a text into words with no case and no accent', () => {
  expect(wordsOf('Tè al Limone')).toEqual(['te', 'al', 'limone']);
  expect(wordsOf('KAHVIMARJA-ENERGIAJUOMA')).toEqual(['kahvimarja', 'energiajuoma']);
  expect(wordsOf('Pappersmugg / Kartonkipikari')).toEqual(['pappersmugg', 'kartonkipikari']);
});
it('drops a plus sign and each other sign', () => {
  expect(wordsOf('Yuzu + Sitruuna')).toEqual(['yuzu', 'sitruuna']);
  expect(wordsOf('Mango+Ananas, 100 %')).toEqual(['mango', 'ananas', '100']);
});
it('keeps the letters of each language of a package', () => {
  expect(wordsOf('Jäätelö Smörgås Æble')).toEqual(['jaatelo', 'smorgas', 'aeble']);
  expect(wordsOf('Straße Øl')).toEqual(['strasse', 'ol']);
});
it('gives no word for an empty text', () => {
  expect(wordsOf('')).toEqual([]);
  expect(wordsOf(' - / ')).toEqual([]);
});

it('gives one key to one amount in each unit', () => {
  expect(sizeKey('330 ml')).toBe('330ml');
  expect(sizeKey('0.33 l')).toBe('330ml');
  expect(sizeKey('0,33L')).toBe('330ml');
  expect(sizeKey('33 cl')).toBe('330ml');
  expect(sizeKey('3.3 dl')).toBe('330ml');
  expect(sizeKey('1 L')).toBe('1000ml');
  expect(sizeKey('500 g')).toBe('500g');
  expect(sizeKey('0.5 kg')).toBe('500g');
  expect(sizeKey('400.0 g')).toBe('400g');
});
it('finds the amount inside a longer text', () => {
  expect(sizeKey('250 ml e')).toBe('250ml');
  expect(sizeKey('Net 330ml')).toBe('330ml');
});
it('multiplies a pack of equal units', () => {
  expect(sizeKey('6 x 330 ml')).toBe('1980ml');
  expect(sizeKey('4x125g')).toBe('500g');
});
it('gives null for a text with no amount, and for a unit that it does not know', () => {
  expect(sizeKey('large')).toBeNull();
  expect(sizeKey('12 pcs')).toBeNull();
  expect(sizeKey('')).toBeNull();
});

it('matches equal words fully', () => {
  expect(wordMatch('vadelma', 'vadelma')).toBe(1);
});
it('matches a word that is cut off, from 4 letters on', () => {
  expect(wordMatch('vadel', 'vadelma')).toBeGreaterThan(0.5);
  expect(wordMatch('vadelma', 'vadel')).toBeGreaterThan(0.5);
  expect(wordMatch('vad', 'vadelma')).toBe(0);
});
it('matches a long word with one wrong letter', () => {
  expect(wordMatch('sitruna', 'sitruuna')).toBeGreaterThan(0.5);
  expect(wordMatch('cascora', 'cascara')).toBeGreaterThan(0.5);
  expect(wordMatch('mango', 'manga')).toBeGreaterThan(0.5);
});
it('does not match short words that differ, and numbers that differ', () => {
  expect(wordMatch('zero', 'hero')).toBe(0);
  expect(wordMatch('kili', 'kiri')).toBe(0);
  expect(wordMatch('12', '5')).toBe(0);
  expect(wordMatch('1250', '1251')).toBe(0);
});
it('an equal word scores more than a similar one', () => {
  expect(wordMatch('vadelma', 'vadelma')).toBeGreaterThan(wordMatch('vadelm', 'vadelma'));
});
