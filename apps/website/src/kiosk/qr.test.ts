import { expect, it } from 'vitest';
import { kioskQr, QR_QUIET_MODULES } from './qr';

it('makes a version 1 code with a quiet zone of 4 modules', () => {
  const qr = kioskQr('K3X7');
  expect(QR_QUIET_MODULES).toBe(4);
  expect(qr.size).toBe(29);
  expect(qr.path.match(/M/g)).toHaveLength(224);
});
it('draws rows as y and columns as x', () => {
  const { path } = kioskQr('K3X7');
  expect(path).toContain('M12 17h1v1h-1z');   // the fixed dark module of a QR code: row 13, column 8
  expect(path).not.toContain('M17 12h1v1h-1z');
});
it('keeps each module out of the quiet zone', () => {
  const { path, size } = kioskQr('K3X7');
  const numbers = [...path.matchAll(/M(\d+) (\d+)h/g)].flatMap((match) => [Number(match[1]), Number(match[2])]);
  expect(Math.min(...numbers)).toBe(QR_QUIET_MODULES);
  expect(Math.max(...numbers)).toBe(size - QR_QUIET_MODULES - 1);
});
it('keeps version 1 for the longest code', () => {
  expect(kioskQr('ABCD1234').size).toBe(29);
});
it('rejects a code that the contract does not allow', () => {
  expect(() => kioskQr('k3')).toThrow(RangeError);
});
