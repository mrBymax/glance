/** Letters that the Unicode decomposition does not split into a base letter and a mark. */
const LETTERS: Record<string, string> = { ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', đ: 'd', ł: 'l', þ: 'th' };

/**
 * The words of a text, for a compare with no case and no accent: each run of letters or digits is one word.
 * A plus sign and each other sign only split words, so "Yuzu + Sitruuna" and "Yuzu Sitruuna" are equal.
 */
export function wordsOf(text: string): string[] {
  return text.toLowerCase().replace(/[ßæøœđłþ]/g, (letter) => LETTERS[letter]!)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/).filter((word) => word !== '');
}

/** How many millilitres or grams one unit holds. */
const UNITS: Record<string, { base: 'ml' | 'g'; factor: number }> = {
  ml: { base: 'ml', factor: 1 }, cl: { base: 'ml', factor: 10 }, dl: { base: 'ml', factor: 100 }, l: { base: 'ml', factor: 1000 },
  g: { base: 'g', factor: 1 }, kg: { base: 'g', factor: 1000 },
};
const AMOUNT = /(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l|kg|g)(?![a-z])/i;

/**
 * One key for one amount: "330 ml", "0.33 l", "0,33L", and "33 cl" all give "330ml", and "0.5 kg" gives "500g".
 * "6 x 330 ml" gives the amount of the whole pack. Returns null for a text with no amount in a unit of volume or weight.
 */
export function sizeKey(text: string): string | null {
  const match = AMOUNT.exec(text);
  if (!match) return null;
  const unit = UNITS[match[3]!.toLowerCase()]!;
  const amount = Number(match[2]!.replace(',', '.')) * unit.factor * (match[1] === undefined ? 1 : Number(match[1]));
  return `${Math.round(amount)}${unit.base}`;
}

/** A word that the camera cut off still counts from this length on. */
const MIN_PREFIX = 4;
/** A word with one wrong letter still counts from this length on. Shorter words differ too little: "zero" and "hero". */
const MIN_FUZZY = 5;

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i += 1;
  // One letter replaced, or one letter more in the longer word.
  const rest = short.length === long.length ? i + 1 : i;
  return short.slice(rest) === long.slice(i + 1);
}

/**
 * How well a word that the model read matches a word of a store item, from 0 to 1.
 * A model reads small print from a blurred frame, so a word can be cut off or can have one wrong letter.
 * 1 for equal words, 0.8 for a word that starts the other one, 0.7 for one wrong letter, else 0. Numbers must be equal.
 */
export function wordMatch(read: string, item: string): number {
  if (read === item) return 1;
  if (/\d/.test(read) || /\d/.test(item)) return 0;
  const shorter = Math.min(read.length, item.length);
  if (shorter >= MIN_PREFIX && (item.startsWith(read) || read.startsWith(item))) return 0.8;
  if (shorter >= MIN_FUZZY && withinOneEdit(read, item)) return 0.7;
  return 0;
}
