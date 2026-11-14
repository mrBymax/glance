import { formatEur, type Cart, type Warning } from '@glance/shared';
import type { Strings } from './strings';

/** Returns an amount in cents as text, for example 189 as "1.89 EUR". */
export function eur(cents: number): string {
  return `${formatEur(cents)} EUR`;
}

/** Returns the sum of the quantities. A line with the quantity 2 counts as 2 items. */
export function itemCount(cart: Cart): number {
  return cart.items.reduce((count, item) => count + item.qty, 0);
}

/** Joins two names with "and". Three or more get commas, and "and" before the last. */
function nameList(names: string[], and: string): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/** Returns the warning as the sentence that the voice speaks. */
export function warningText(warning: Warning, strings: Strings): string {
  switch (warning.kind) {
    case 'allergen':
      return strings.warningAllergen(nameList(warning.allergens.map((key) => strings.allergenNames[key].toLowerCase()), strings.and));
    case 'diet':
      return strings.warningDiet(strings[warning.diet].toLowerCase());
    case 'allergenDataMissing':
      return strings.allergenDataMissing;
    default: {
      const unknown: never = warning;
      return unknown;
    }
  }
}

/** Returns the line that the live region speaks after a cart change. The total is the total of the server. */
export function cartStatusLine(cart: Cart, strings: Strings): string {
  return strings.cartStatus(itemCount(cart), eur(cart.totalCents));
}
