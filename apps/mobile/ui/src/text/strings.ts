import type { Lang } from '@glance/shared';

/** Each string of the phone UI, in English. */
export const EN = {
  appTitle: 'Glance',
  idleHint: 'Hold a product up to hear its price.',
  add: 'Add',
  skip: 'Skip',
  addAnother: 'Add another',
  removeOne: 'Remove one',
  inCart: (qty: number) => `In your cart: ${qty}`,
  captions: 'Captions',
  noCaptions: 'Each line that the voice speaks shows here.',
  cart: 'Cart',
  cartEmpty: 'Your cart is empty.',
  cartLine: (packSize: string, qty: number, unit: string) => `${packSize}, ${qty} x ${unit}`,
  total: 'Total',
  items: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  cartStatus: (count: number, total: string) => (count === 0 ? 'Cart: empty.' : `Cart: ${count === 1 ? '1 item' : `${count} items`}, ${total}.`),
};

export type Strings = typeof EN;

/** Returns the English strings for each language. No other language exists yet. */
export function stringsFor(_lang: Lang): Strings {
  return EN;
}
