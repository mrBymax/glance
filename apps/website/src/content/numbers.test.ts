import { expect, it } from 'vitest';
import { copyProblems } from './copyRules';
import { formatMeasured, parseNumbers } from './numbers';
import numbersJson from './numbers.json';

const item = { id: 'false-yes', label: 'False yes in the walk test', value: null, unit: 'in 15 minutes', note: '' };

it('accepts the committed file, and its text passes the copy rules', () => {
  const numbers = parseNumbers(numbersJson);
  expect(numbers.items.length).toBeGreaterThan(0);
  expect(copyProblems(numbers.items.flatMap((i) => [i.label, i.note]))).toEqual([]);
});
it('rejects a value that is not null or a finite number, and names the item', () => {
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: '0' }] })).toThrow(/false-yes/);
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: Number.NaN }] })).toThrow(/false-yes/);
});
it('rejects two items with one ID', () => {
  expect(() => parseNumbers({ context: null, items: [item, item] })).toThrow(/false-yes/);
});
it('rejects a measured value with no context sentence', () => {
  expect(() => parseNumbers({ context: null, items: [{ ...item, value: 0 }] })).toThrow(/context/);
});
it('shows a missing value as "Not measured yet"', () => {
  expect(formatMeasured(item)).toBe('Not measured yet');
});
it('shows a value of 0 with its unit', () => {
  expect(formatMeasured({ ...item, value: 0 })).toBe('0 in 15 minutes');
  expect(formatMeasured({ ...item, value: 2.4, unit: 's' })).toBe('2.4 s');
});
