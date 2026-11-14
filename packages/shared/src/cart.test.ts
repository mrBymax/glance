import { describe, expect, it } from 'vitest';
import { CartItemSchema, EMPTY_CART } from './cart';

describe('cart', () => {
  it('has an empty cart constant', () => {
    expect(EMPTY_CART).toEqual({ items: [], totalCents: 0 });
  });
  it('freezes the empty cart, because each app shares the one object', () => {
    expect(Object.isFrozen(EMPTY_CART)).toBe(true);
    expect(Object.isFrozen(EMPTY_CART.items)).toBe(true);
    expect(() => EMPTY_CART.items.push({ productId: 'rye-bread', name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 }))
      .toThrow(TypeError);
    expect(EMPTY_CART).toEqual({ items: [], totalCents: 0 });
  });
  it('rejects a quantity of zero', () => {
    const item = { productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty: 0, unitPriceCents: 189 };
    expect(CartItemSchema.safeParse(item).success).toBe(false);
  });
});
