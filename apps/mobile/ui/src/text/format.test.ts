import { expect, it } from 'vitest';
import { cartStatusLine, eur, itemCount, warningText } from './format';
import { EN } from './strings';

it('formats an amount with the currency code', () => {
  expect(eur(189)).toBe('1.89 EUR');
  expect(eur(123456)).toBe('1234.56 EUR');
});
it('states the cart for the live region', () => {
  const line = (qty: number, totalCents: number) => cartStatusLine({
    items: qty === 0 ? [] : [{ productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty, unitPriceCents: 189 }],
    totalCents,
  }, EN);
  expect(line(0, 0)).toBe('Cart: empty.');
  expect(line(1, 189)).toBe('Cart: 1 item, 1.89 EUR.');
  expect(line(2, 378)).toBe('Cart: 2 items, 3.78 EUR.');
});
it('counts the units of a cart, not its lines', () => {
  const item = (productId: string, qty: number) => ({ productId, name: 'Product', packSize: '1 L', qty, unitPriceCents: 100 });
  expect(itemCount({ items: [item('a', 2), item('b', 1)], totalCents: 300 })).toBe(3);
});
it('writes each warning as one sentence', () => {
  expect(warningText({ kind: 'allergen', allergens: ['gluten'] }, EN)).toBe('Warning: contains gluten.');
  expect(warningText({ kind: 'allergen', allergens: ['gluten', 'milk'] }, EN)).toBe('Warning: contains gluten and milk.');
  expect(warningText({ kind: 'allergen', allergens: ['gluten', 'milk', 'nuts'] }, EN)).toBe('Warning: contains gluten, milk and nuts.');
  expect(warningText({ kind: 'diet', diet: 'vegan' }, EN)).toBe('Warning: not vegan.');
  expect(warningText({ kind: 'diet', diet: 'vegetarian' }, EN)).toBe('Warning: not vegetarian.');
  expect(warningText({ kind: 'allergenDataMissing' }, EN)).toBe('Allergen data is missing for this product.');
});
