import type { Lang } from '@glance/shared';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const ONES_IT = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici',
  'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const TENS_IT = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

const MAX_NUMBER = 9999;
const MAX_PRICE_CENTS = 999_999;

function underHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return ones === 0 ? TENS[Math.floor(n / 10)]! : `${TENS[Math.floor(n / 10)]}-${ONES[ones]}`;
}

function englishWords(n: number): string {
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

/** The tens lose their last vowel before "uno" and "otto": ventuno, ventotto. */
function underHundredIt(n: number): string {
  if (n < 20) return ONES_IT[n]!;
  const tens = TENS_IT[Math.floor(n / 10)]!;
  const ones = n % 10;
  if (ones === 0) return tens;
  return `${ones === 1 || ones === 8 ? tens.slice(0, -1) : tens}${ONES_IT[ones]}`;
}

/** A longer number that ends in "tre" has an accent on its last letter: ventitré. */
function withAccent(word: string): string {
  return word !== 'tre' && word.endsWith('tre') ? `${word.slice(0, -1)}é` : word;
}

/** One word: centoventitré, milleduecentotrentaquattro. */
function italianWords(n: number): string {
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  let word = '';
  if (thousands === 1) word += 'mille';
  else if (thousands > 1) word += `${ONES_IT[thousands]}mila`;
  if (hundreds > 0) {
    const cento = hundreds === 1 ? 'cento' : `${ONES_IT[hundreds]}cento`;
    // "cento" loses its last vowel before "otto" and "ottanta": centotto, centottanta.
    word += rest === 8 || Math.floor(rest / 10) === 8 ? cento.slice(0, -1) : cento;
  }
  if (rest > 0 || word === '') word += underHundredIt(rest);
  return withAccent(word);
}

/** Writes an integer from 0 to 9999 as words. English has no "and": 101 is "one hundred one". Italian is one word. */
export function numberToWords(n: number, lang: Lang): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) {
    throw new RangeError(`A spoken number is an integer from 0 to ${MAX_NUMBER}. Got ${n}.`);
  }
  return lang === 'it' ? italianWords(n) : englishWords(n);
}

function englishPrice(euros: number, rest: number, form: 'short' | 'full'): string {
  if (form === 'short' && euros >= 1 && euros <= 99 && rest >= 1) {
    const restWords = rest < 10 ? `oh ${englishWords(rest)}` : englishWords(rest);
    return `${englishWords(euros)} ${restWords}`;
  }

  const centsWords = `${englishWords(rest)} ${rest === 1 ? 'cent' : 'cents'}`;
  if (euros === 0) return rest === 0 ? 'zero euros' : centsWords;
  const eurosWords = `${englishWords(euros)} ${euros === 1 ? 'euro' : 'euros'}`;
  if (rest === 0) return eurosWords;
  return rest < 10 ? `${eurosWords} and ${centsWords}` : `${eurosWords} ${englishWords(rest)}`;
}

/** The word "euro" has one form for each amount. One euro and one cent take "un". */
function italianPrice(euros: number, rest: number, form: 'short' | 'full'): string {
  if (form === 'short' && euros >= 1 && euros <= 99 && rest >= 1) {
    const restWords = rest < 10 ? `zero ${italianWords(rest)}` : italianWords(rest);
    return `${italianWords(euros)} e ${restWords}`;
  }

  const centsWords = rest === 1 ? 'un centesimo' : `${italianWords(rest)} centesimi`;
  if (euros === 0) return rest === 0 ? 'zero euro' : centsWords;
  const eurosWords = euros === 1 ? 'un euro' : `${italianWords(euros)} euro`;
  if (rest === 0) return eurosWords;
  return rest < 10 ? `${eurosWords} e ${centsWords}` : `${eurosWords} e ${italianWords(rest)}`;
}

/**
 * Writes a price as a shopper says it.
 * Short form: "one eighty-nine", for 1 to 99 euros with 1 to 99 cents. Each other amount gets the full form.
 * Full form: "one euro eighty-nine", "six euros and five cents", "twenty euros", "ninety-nine cents".
 * Italian short form: "uno e ottantanove". Italian full form: "un euro e ottantanove", "venti euro", "novantanove centesimi".
 * Throws RangeError unless `cents` is an integer from 0 to 999999.
 */
export function spokenPrice(cents: number, lang: Lang, form: 'short' | 'full'): string {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
    throw new RangeError(`A spoken price is an integer from 0 to ${MAX_PRICE_CENTS} cents. Got ${cents}.`);
  }
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return lang === 'it' ? italianPrice(euros, rest, form) : englishPrice(euros, rest, form);
}
