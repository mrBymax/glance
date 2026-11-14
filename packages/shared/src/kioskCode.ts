export const KIOSK_CODE_PREFIX = 'GL1';

const CODE = /^[A-Z0-9]{4,8}$/;

/** Returns the QR text of a kiosk code, for example "GL1 K3X7". */
export function formatKioskCode(code: string): string {
  if (!CODE.test(code)) {
    throw new RangeError('A kiosk code has 4 to 8 characters from A-Z and 0-9.');
  }
  return `${KIOSK_CODE_PREFIX} ${code}`;
}

/**
 * Returns the kiosk code of a QR text, or null when the text is not a kiosk code.
 * A QR decoder can return lowercase letters and extra spaces, so the text is normalized first.
 */
export function parseKioskCode(text: string): string | null {
  const [prefix, code, ...rest] = text.trim().toUpperCase().split(/\s+/);
  if (prefix !== KIOSK_CODE_PREFIX || code === undefined || rest.length > 0) return null;
  return CODE.test(code) ? code : null;
}
