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
