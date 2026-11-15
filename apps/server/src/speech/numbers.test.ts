import { expect, it } from 'vitest';
import { numberToWords, spokenPrice } from './numbers';

it('speaks the short form', () => {
  expect(spokenPrice(189, 'en', 'short')).toBe('one eighty-nine');
  expect(spokenPrice(449, 'en', 'short')).toBe('four forty-nine');
  expect(spokenPrice(260, 'en', 'short')).toBe('two sixty');
  expect(spokenPrice(2110, 'en', 'short')).toBe('twenty-one ten');
  expect(spokenPrice(105, 'en', 'short')).toBe('one oh five');
  expect(spokenPrice(200, 'en', 'short')).toBe('two euros');
  expect(spokenPrice(99, 'en', 'short')).toBe('ninety-nine cents');
  expect(spokenPrice(12345, 'en', 'short')).toBe('one hundred twenty-three euros forty-five');
});
it('speaks the full form', () => {
  expect(spokenPrice(639, 'en', 'full')).toBe('six euros thirty-nine');
  expect(spokenPrice(189, 'en', 'full')).toBe('one euro eighty-nine');
  expect(spokenPrice(2000, 'en', 'full')).toBe('twenty euros');
  expect(spokenPrice(605, 'en', 'full')).toBe('six euros and five cents');
  expect(spokenPrice(1, 'en', 'full')).toBe('one cent');
  expect(spokenPrice(0, 'en', 'full')).toBe('zero euros');
});
it('speaks the largest price', () => {
  expect(spokenPrice(999999, 'en', 'full')).toBe('nine thousand nine hundred ninety-nine euros ninety-nine');
});
it('rejects a price that is negative, not an integer, or too large', () => {
  expect(() => spokenPrice(-1, 'en', 'short')).toThrow(RangeError);
  expect(() => spokenPrice(1.5, 'en', 'full')).toThrow(RangeError);
  expect(() => spokenPrice(1000000, 'en', 'full')).toThrow(RangeError);
});
it('writes numbers as words', () => {
  const words = [0, 7, 13, 20, 21, 40, 99, 100, 101, 110, 999, 1000, 1234, 9999].map((n) => numberToWords(n, 'en'));
  expect(words).toEqual([
    'zero', 'seven', 'thirteen', 'twenty', 'twenty-one', 'forty', 'ninety-nine', 'one hundred', 'one hundred one',
    'one hundred ten', 'nine hundred ninety-nine', 'one thousand', 'one thousand two hundred thirty-four',
    'nine thousand nine hundred ninety-nine',
  ]);
});
it('rejects a number outside 0 to 9999', () => {
  expect(() => numberToWords(10000, 'en')).toThrow(RangeError);
  expect(() => numberToWords(-1, 'en')).toThrow(RangeError);
  expect(() => numberToWords(2.5, 'en')).toThrow(RangeError);
});
it('speaks Italian prices and numbers', () => {
  expect(spokenPrice(189, 'it', 'short')).toBe('uno e ottantanove');
  expect(spokenPrice(449, 'it', 'short')).toBe('quattro e quarantanove');
  expect(spokenPrice(2110, 'it', 'short')).toBe('ventuno e dieci');
  expect(spokenPrice(639, 'it', 'full')).toBe('sei euro e trentanove');
  expect(spokenPrice(189, 'it', 'full')).toBe('un euro e ottantanove');
  expect(spokenPrice(2000, 'it', 'full')).toBe('venti euro');
  expect(spokenPrice(99, 'it', 'full')).toBe('novantanove centesimi');
  expect([1, 8, 21, 23, 28, 38, 100, 123, 1000, 2000].map((n) => numberToWords(n, 'it')))
    .toEqual(['uno', 'otto', 'ventuno', 'ventitré', 'ventotto', 'trentotto', 'cento', 'centoventitré', 'mille', 'duemila']);
});
it('speaks the other Italian price forms', () => {
  expect(spokenPrice(105, 'it', 'short')).toBe('uno e zero cinque');
  expect(spokenPrice(200, 'it', 'short')).toBe('due euro');
  expect(spokenPrice(100, 'it', 'short')).toBe('un euro');
  expect(spokenPrice(99, 'it', 'short')).toBe('novantanove centesimi');
  expect(spokenPrice(12345, 'it', 'short')).toBe('centoventitré euro e quarantacinque');
  expect(spokenPrice(605, 'it', 'full')).toBe('sei euro e cinque centesimi');
  expect(spokenPrice(601, 'it', 'full')).toBe('sei euro e un centesimo');
  expect(spokenPrice(1, 'it', 'full')).toBe('un centesimo');
  expect(spokenPrice(0, 'it', 'full')).toBe('zero euro');
  expect(spokenPrice(2100, 'it', 'full')).toBe('ventuno euro');
  expect(spokenPrice(999999, 'it', 'full')).toBe('novemilanovecentonovantanove euro e novantanove');
});
it('writes Italian numbers as one word', () => {
  const words = [0, 3, 10, 13, 17, 19, 20, 33, 40, 48, 81, 88, 99, 101, 103, 108, 110, 180, 188, 200, 999, 1001, 1003, 1100, 1234, 3000, 9999]
    .map((n) => numberToWords(n, 'it'));
  expect(words).toEqual([
    'zero', 'tre', 'dieci', 'tredici', 'diciassette', 'diciannove', 'venti', 'trentatré', 'quaranta', 'quarantotto',
    'ottantuno', 'ottantotto', 'novantanove', 'centouno', 'centotré', 'centotto', 'centodieci', 'centottanta', 'centottantotto',
    'duecento', 'novecentonovantanove', 'milleuno', 'milletré', 'millecento', 'milleduecentotrentaquattro', 'tremila',
    'novemilanovecentonovantanove',
  ]);
  expect(() => numberToWords(10000, 'it')).toThrow(RangeError);
});
