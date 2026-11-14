import { formatEur, type Cart } from '@glance/shared';
import type { Strings } from './strings';

/** Returns an amount in cents as text, for example 189 as "1.89 EUR". */
export function eur(cents: number): string {
  return `${formatEur(cents)} EUR`;
}

/** Returns the sum of the quantities. A line with the quantity 2 counts as 2 items. */
export function itemCount(cart: Cart): number {
  return cart.items.reduce((count, item) => count + item.qty, 0);
}

/** Returns the line that the live region speaks after a cart change. The total is the total of the server. */
export function cartStatusLine(cart: Cart, strings: Strings): string {
  return strings.cartStatus(itemCount(cart), eur(cart.totalCents));
}
