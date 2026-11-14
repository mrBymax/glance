import { describe, expect, it } from 'vitest';
import { formatKioskCode, parseKioskCode } from './kioskCode';

describe('kiosk code', () => {
  it('formats a kiosk code as QR text', () => {
    expect(formatKioskCode('K3X7')).toBe('GL1 K3X7');
    expect(formatKioskCode('ABCD1234').length).toBeLessThanOrEqual(20);
  });
  it('rejects a code that is too short, too long, or has other characters', () => {
    expect(() => formatKioskCode('K3')).toThrow(RangeError);
    expect(() => formatKioskCode('TOOLONGCODE')).toThrow(RangeError);
    expect(() => formatKioskCode('k3x7')).toThrow(RangeError);
  });
  it('parses QR text back to the code', () => {
    expect(parseKioskCode('GL1 K3X7')).toBe('K3X7');
  });
  it('accepts lowercase letters and extra spaces from a decoder', () => {
    expect(parseKioskCode('  gl1   k3x7 \n')).toBe('K3X7');
  });
  it('returns null for text that is not a kiosk code', () => {
    expect(parseKioskCode('https://example.com/k/1')).toBeNull();
    expect(parseKioskCode('GL2 K3X7')).toBeNull();
    expect(parseKioskCode('GL1 TOOLONGCODE')).toBeNull();
    expect(parseKioskCode('')).toBeNull();
  });
});
