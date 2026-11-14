import { describe, expect, it } from 'vitest';
import { CartItemSchema, EMPTY_CART } from './cart';

describe('cart', () => {
  it('has an empty cart constant', () => {
    expect(EMPTY_CART).toEqual({ items: [], totalCents: 0 });
  });
  it('rejects a quantity of zero', () => {
    const item = { productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty: 0, unitPriceCents: 189 };
    expect(CartItemSchema.safeParse(item).success).toBe(false);
  });
});
