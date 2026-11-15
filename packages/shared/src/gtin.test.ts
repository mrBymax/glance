import { describe, expect, it } from 'vitest';
import { expandUpcE, hasGs1CheckDigit, isStoreInternalGtin, normalizeGtin } from './gtin';

describe('GTIN', () => {
  it('accepts the check digit of published codes of each length', () => {
    for (const code of ['4006381333931', '3017624010701', '8076809513753', '036000291452', '73513537', '00012345600012']) {
      expect(hasGs1CheckDigit(code), code).toBe(true);
    }
  });
  it('rejects a wrong check digit, two swapped digits, and text that is not digits', () => {
    for (const code of ['4006381333932', '4006381333913', '8076809513758', '03600029145 2', '4006381E33931', '']) {
      expect(hasGs1CheckDigit(code), code).toBe(false);
    }
  });
  it('expands UPC-E to UPC-A for each last digit', () => {
    expect(expandUpcE('01234565')).toBe('012345000065');
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(expandUpcE('01200003')).toBe('012000000003');
    expect(expandUpcE('01234514')).toBe('012100003454');
    expect(expandUpcE('01234523')).toBe('012200003453');
    expect(expandUpcE('01234531')).toBe('012300000451');
    expect(expandUpcE('01234543')).toBe('012340000053');
    expect(expandUpcE('11234593')).toBe('112345000093');
  });
  it('expands no text that is not UPC-E', () => {
    for (const code of ['1234565', '012345650', '21234565', '0123456A', '']) expect(expandUpcE(code), code).toBeNull();
  });
  it('normalises EAN-13, UPC-A, and EAN-8 to 13 digits', () => {
    expect(normalizeGtin('8076809513753')).toBe('8076809513753');
    expect(normalizeGtin('036000291452')).toBe('0036000291452');
    expect(normalizeGtin('73513537')).toBe('0000073513537');
  });
  it('expands 8 digits as UPC-E only when the caller names the format', () => {
    expect(normalizeGtin('01234565', { upcE: true })).toBe('0012345000065');
    expect(normalizeGtin('04252614', { upcE: true })).toBe('0042100005264');
    // 04252614 has the check digit of its UPC-A form. It is no valid EAN-8.
    expect(normalizeGtin('04252614')).toBeNull();
    expect(normalizeGtin('036000291452', { upcE: true })).toBe('0036000291452');
  });
  it('gives null for a wrong check digit, another length, and text that is not digits', () => {
    for (const code of ['8076809513758', '036000291453', '73513538', '00012345600012', '12345', ' 8076809513753', '807680951375E']) {
      expect(normalizeGtin(code), code).toBeNull();
    }
    expect(normalizeGtin('04252615', { upcE: true })).toBeNull();
    expect(normalizeGtin('91234565', { upcE: true })).toBeNull();
  });
  it('knows the codes of one store', () => {
    for (const gtin of ['2000000000008', '2912345678906', '0412345678903', '0212345678909']) {
      expect(isStoreInternalGtin(gtin), gtin).toBe(true);
    }
    for (const gtin of ['8076809513753', '0036000291452', '0012345000065', '4006381333931', '0000073513537']) {
      expect(isStoreInternalGtin(gtin), gtin).toBe(false);
    }
  });
});
