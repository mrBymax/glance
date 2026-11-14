import { describe, expect, it } from 'vitest';
import { cartTotalCents, formatEur } from './money';

describe('money', () => {
  it('formats cents as euros with two decimals', () => {
    expect(formatEur(189)).toBe('1.89');
    expect(formatEur(260)).toBe('2.60');
    expect(formatEur(5)).toBe('0.05');
    expect(formatEur(0)).toBe('0.00');
    expect(formatEur(123456)).toBe('1234.56');
  });
  it('rejects a price that is negative or not an integer', () => {
    expect(() => formatEur(-1)).toThrow(RangeError);
    expect(() => formatEur(1.5)).toThrow(RangeError);
  });
  it('adds the lines of a cart', () => {
    expect(cartTotalCents([])).toBe(0);
    expect(cartTotalCents([{ unitPriceCents: 260, qty: 1 }, { unitPriceCents: 189, qty: 1 }])).toBe(449);
    expect(cartTotalCents([{ unitPriceCents: 190, qty: 2 }])).toBe(380);
  });
});
