import { formatEur } from '@glance/shared';

/** Returns an amount in cents as text, for example 449 as "4.49 EUR". */
export function eur(cents: number): string {
  return `${formatEur(cents)} EUR`;
}
