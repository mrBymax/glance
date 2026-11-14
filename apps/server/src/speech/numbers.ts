import type { Lang } from '@glance/shared';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const MAX_NUMBER = 9999;
const MAX_PRICE_CENTS = 999_999;

function underHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return ones === 0 ? TENS[Math.floor(n / 10)]! : `${TENS[Math.floor(n / 10)]}-${ONES[ones]}`;
}

/**
 * Writes an integer from 0 to 9999 as words, with no "and": 101 is "one hundred one".
 * Each language gives English words until the Italian lines exist.
 */
export function numberToWords(n: number, _lang: Lang): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) {
    throw new RangeError(`A spoken number is an integer from 0 to ${MAX_NUMBER}. Got ${n}.`);
  }
  if (n < 100) return underHundred(n);
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands > 0) parts.push(`${ONES[thousands]} thousand`);
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) parts.push(underHundred(rest));
  return parts.join(' ');
}

/**
 * Writes a price as a shopper says it.
 * Short form: "one eighty-nine", for 1 to 99 euros with 1 to 99 cents. Each other amount gets the full form.
 * Full form: "one euro eighty-nine", "six euros and five cents", "twenty euros", "ninety-nine cents".
 * Throws RangeError unless `cents` is an integer from 0 to 999999.
 */
export function spokenPrice(cents: number, lang: Lang, form: 'short' | 'full'): string {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
    throw new RangeError(`A spoken price is an integer from 0 to ${MAX_PRICE_CENTS} cents. Got ${cents}.`);
  }
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;

  if (form === 'short' && euros >= 1 && euros <= 99 && rest >= 1) {
    const restWords = rest < 10 ? `oh ${numberToWords(rest, lang)}` : numberToWords(rest, lang);
    return `${numberToWords(euros, lang)} ${restWords}`;
  }

  const centsWords = `${numberToWords(rest, lang)} ${rest === 1 ? 'cent' : 'cents'}`;
  if (euros === 0) return rest === 0 ? 'zero euros' : centsWords;
  const eurosWords = `${numberToWords(euros, lang)} ${euros === 1 ? 'euro' : 'euros'}`;
  if (rest === 0) return eurosWords;
  return rest < 10 ? `${eurosWords} and ${centsWords}` : `${eurosWords} ${numberToWords(rest, lang)}`;
}
