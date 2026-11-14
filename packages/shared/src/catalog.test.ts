import { describe, expect, it } from 'vitest';
import oatDrink from '../fixtures/catalog/oat-drink-1l.json';
import { ProductSchema, toProductRef } from './catalog';

describe('catalog', () => {
  it('accepts the fixture product', () => {
    expect(ProductSchema.parse(oatDrink).priceCents).toBe(189);
  });
  it('defaults lookAlikes to an empty list', () => {
    const { lookAlikes, ...rest } = oatDrink;
    expect(ProductSchema.parse(rest).lookAlikes).toEqual([]);
  });
  it('accepts a product with no allergen data', () => {
    expect(ProductSchema.safeParse({ ...oatDrink, allergens: null }).success).toBe(true);
  });
  it('rejects a price that is not an integer or is negative', () => {
    expect(ProductSchema.safeParse({ ...oatDrink, priceCents: 1.5 }).success).toBe(false);
    expect(ProductSchema.safeParse({ ...oatDrink, priceCents: -1 }).success).toBe(false);
  });
  it('makes a product reference in the language of the session', () => {
    expect(toProductRef(ProductSchema.parse(oatDrink), 'it')).toEqual({
      id: 'oat-drink-1l', name: 'Bevanda di avena', packSize: '1 L', priceCents: 189,
    });
  });
});
