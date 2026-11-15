const DIGITS = /^\d+$/;
const UPC_E = /^[01]\d{7}$/;

/**
 * The GS1 check of EAN-8, UPC-A, EAN-13, and GTIN-14: from the right, the digits count 1, 3, 1, 3,
 * and the sum must end in 0. It does not check the length. Text that is not digits fails.
 */
export function hasGs1CheckDigit(code: string): boolean {
  if (!DIGITS.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < code.length; index += 1) {
    const digit = Number(code[code.length - 1 - index]);
    sum += index % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

/**
 * Returns the 12 digits of the UPC-A form of a UPC-E code, or null when the text is not UPC-E.
 * UPC-E has 8 digits: the number system 0 or 1, 6 digits, and the check digit of the UPC-A form.
 * It does not check the check digit.
 */
export function expandUpcE(code: string): string | null {
  if (!UPC_E.test(code)) return null;
  const system = code[0];
  const body = code.slice(1, 7);
  const check = code[7];
  const last = body[5];
  // The last of the 6 digits says where the zeros go.
  if (last === '0' || last === '1' || last === '2') return `${system}${body.slice(0, 2)}${last}0000${body.slice(2, 5)}${check}`;
  if (last === '3') return `${system}${body.slice(0, 3)}00000${body.slice(3, 5)}${check}`;
  if (last === '4') return `${system}${body.slice(0, 4)}00000${body[4]}${check}`;
  return `${system}${body.slice(0, 5)}0000${last}${check}`;
}

/**
 * Returns the 13 digits of a code of 8, 12, or 13 digits, or null when the length or the check digit is wrong.
 * EAN-8 and UPC-E both have 8 digits, and the digits do not tell them apart.
 * So 8 digits are EAN-8, and only `upcE: true` makes them UPC-E.
 */
export function normalizeGtin(code: string, opts: { upcE?: boolean } = {}): string | null {
  if (!DIGITS.test(code)) return null;
  const full = opts.upcE === true && code.length === 8 ? expandUpcE(code) : code;
  if (full === null || ![8, 12, 13].includes(full.length) || !hasGs1CheckDigit(full)) return null;
  return full.padStart(13, '0');
}

/**
 * True for a 13-digit code that only one store or one company can know: it starts with 2, 02, or 04.
 * 02 and 04 are the UPC-A number systems 2 and 4. An open product database cannot resolve such a code.
 */
export function isStoreInternalGtin(gtin13: string): boolean {
  return gtin13.startsWith('2') || gtin13.startsWith('02') || gtin13.startsWith('04');
}
