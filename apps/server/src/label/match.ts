import { normalizeGtin } from '@glance/shared';
import type { StoreItem } from '../products/storeList';
import type { LabelAnswer } from './reader';

/** Lower case, no accent, and each run of letters or digits is one word. */
function words(text: string): string[] {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word !== '');
}

/**
 * The words that the answer must hold: each word of 3 letters or more, and each number.
 * "n", "al", and "De" are easy to misread and tell no product apart. A text with only such words keeps each of them.
 */
function requiredWords(text: string): string[] {
  const all = words(text);
  const long = all.filter((word) => word.length >= 3 || /\d/.test(word));
  return long.length > 0 ? long : all;
}

/** "400 g", "400g", and "400.0 G" are one pack size. */
function packKey(packSize: string): string {
  return packSize.toLowerCase().replace(/\s/g, '').replace(/(\d)\.0+(?=\D|$)/, '$1');
}

/**
 * Selects the store item of a label, or returns null. Free text of the model never becomes a product by itself:
 * 1. Digits count with a right check digit and an item of the store list. Two codes of two items give no product.
 * 2. Else the brand and the name must select exactly one item: the brand, the name, and the pack size of the answer
 *    together hold each word of the brand of the item, each word of its name, and each number of that name.
 *    Words of 1 or 2 letters do not count. An item with no brand never matches this way.
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
  const read = new Set(words(`${answer.brand ?? ''} ${answer.name ?? ''} ${answer.packSize ?? ''}`));
  let matches = items.filter((item) => {
    if (item.brand === undefined) return false;
    const brand = requiredWords(item.brand);
    // Each word counts: "Pesto alla calabrese" must not select "Pesto alla genovese", and "Spaghetti n.3" not "Spaghetti n.5".
    const name = requiredWords(item.name);
    return brand.length > 0 && name.length > 0 && [...brand, ...name].every((word) => read.has(word));
  });
  if (matches.length > 1 && answer.packSize !== null) {
    const pack = packKey(answer.packSize);
    matches = matches.filter((item) => item.packSize !== undefined && packKey(item.packSize) === pack);
  }
  return matches.length === 1 ? matches[0]!.gtin : null;
}
