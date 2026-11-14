import { z } from 'zod';

/** Formats an amount in cents as euros with two decimals, for example 189 as "1.89". */
export function formatEur(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`A price is an integer of 0 or more cents. Got ${cents}.`);
  }
  const euros = Math.floor(cents / 100);
  return `${euros}.${String(cents % 100).padStart(2, '0')}`;
}

/** Adds the lines of a cart. Only the server uses the result as a total. */
export function cartTotalCents(items: readonly { unitPriceCents: number; qty: number }[]): number {
  return items.reduce((total, item) => total + item.unitPriceCents * item.qty, 0);
}

/** An amount of money: an integer number of cents in EUR, 0 or more. */
export const CentsSchema = z.number().int().min(0);
