import { formatKioskCode } from '@glance/shared';
import QRCode from 'qrcode';

/** The QR standard requires a quiet zone of 4 modules on each side. */
export const QR_QUIET_MODULES = 4;

/**
 * Returns the QR code of a kiosk code as an SVG path, one square for each dark module, in row order.
 * `size` is the width in modules, and it counts the quiet zone on both sides.
 * A code that the contract does not allow makes formatKioskCode throw RangeError.
 */
export function kioskQr(code: string): { size: number; path: string } {
  const { modules } = QRCode.create(formatKioskCode(code), { errorCorrectionLevel: 'M' });
  const parts: string[] = [];
  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.get(row, column)) parts.push(`M${column + QR_QUIET_MODULES} ${row + QR_QUIET_MODULES}h1v1h-1z`);
    }
  }
  return { size: modules.size + 2 * QR_QUIET_MODULES, path: parts.join('') };
}
