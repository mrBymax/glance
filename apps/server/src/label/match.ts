import { normalizeGtin } from '@glance/shared';
import type { StoreItem } from '../products/storeList';
import type { LabelAnswer } from './reader';

/** Lower case, no accent, and each run of letters or digits is one word. */
function words(text: string): string[] {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word !== '');
}

/** "400 g", "400g", and "400.0 G" are one pack size. */
function packKey(packSize: string): string {
  return packSize.toLowerCase().replace(/\s/g, '').replace(/(\d)\.0+(?=\D|$)/, '$1');
}

/**
 * Selects the store item of a label, or returns null. Free text of the model never becomes a product by itself:
 * 1. Digits count with a right check digit and an item of the store list. Two codes of two items give no product.
 * 2. Else the brand and the name must select exactly one item: the answer holds each word of the brand of the item
 *    and at least half of the words of its name, with each number of that name. An item with no brand never matches this way.
 *    Between items with one brand and one name, the pack size selects. Two matches or none give no product.
 * The second way also needs the confidence `minConfidence`. Returns the 13 digits of the item.
 */
export function matchLabel(answer: LabelAnswer, items: readonly StoreItem[], minConfidence: number): string | null {
  const sold = new Set(items.map((item) => item.gtin));
  const codes = new Set<string>();
  for (const digits of answer.digits) {
    const gtin = normalizeGtin(digits.replace(/\s/g, ''));
    if (gtin !== null && sold.has(gtin)) codes.add(gtin);
  }
  if (codes.size > 0) return codes.size === 1 ? [...codes][0]! : null;

  if (answer.confidence < minConfidence) return null;
  const read = new Set(words(`${answer.brand ?? ''} ${answer.name ?? ''}`));
  let matches = items.filter((item) => {
    if (item.brand === undefined) return false;
    const brand = words(item.brand);
    const name = words(item.name);
    if (brand.length === 0 || name.length === 0 || !brand.every((word) => read.has(word))) return false;
    // "Spaghetti n.3" must not select "Spaghetti n.5": a number tells the products of one line apart.
    if (!name.every((word) => !/\d/.test(word) || read.has(word))) return false;
    return name.filter((word) => read.has(word)).length * 2 >= name.length;
  });
  if (matches.length > 1 && answer.packSize !== null) {
    const pack = packKey(answer.packSize);
    matches = matches.filter((item) => item.packSize !== undefined && packKey(item.packSize) === pack);
  }
  return matches.length === 1 ? matches[0]!.gtin : null;
}
