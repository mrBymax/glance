import { DEFAULT_PROFILE, type Lang, type Product } from '@glance/shared';
import type { Line } from '../sessions/types';
import { renderLine } from './render';

/** A line with no parameter has one text for each shopper with the default profile. */
type FixedKey = { [K in Line['key']]: { key: K } extends Extract<Line, { key: K }> ? K : never }[Line['key']];

/** An extra that adds a line with no parameter adds its key here. */
const FIXED_KEYS: readonly FixedKey[] = [
  'session.start', 'session.rest', 'glance.unknown', 'glance.skipped', 'undo.nothing',
  'hint.lookAtCode',
  'checkout.empty', 'checkout.busy', 'checkout.cancelled', 'checkout.failed', 'checkout.biometric',
  'info.help', 'device.cameraOff', 'device.regularCheckout', 'device.paused',
  'net.backOnline', 'recognition.slow',
  'ask.listening', 'ask.noProduct', 'ask.failed',
  'spotcheck.thanks',
  'barcode.notInStore', 'barcode.unreadable',
];

const AIM_HINTS = ['left', 'right', 'up', 'down', 'closer', 'farther', 'turn'] as const;

/** The forms of a product prompt for a shopper with no warning: with and with no yes phrase, and for one unit in the cart. */
const promptForms = (product: Product): Line[] => [
  { key: 'glance.new', product, hint: true, warnings: [] },
  { key: 'glance.new', product, hint: false, warnings: [] },
  { key: 'glance.inCart', product, qty: 1, warnings: [] },
];

/**
 * The texts of the product prompts of each product, for the default profile in the language `lang`.
 * The rules speak the form with the yes phrase in the first 2 prompts of a session, and the form with none after them.
 * The price is a part of each text, so a new price gives a new text and a new clip.
 */
export function promptLines(products: readonly Product[], lang: Lang = DEFAULT_PROFILE.lang): string[] {
  const profile = { ...DEFAULT_PROFILE, lang };
  return [...new Set(products.flatMap(promptForms).map((line) => renderLine(line, profile)))];
}

/**
 * The texts that the seed makes clips for: the lines that a shop with the default profile is sure to need.
 * A line with a total or an item count is not in the list, because its text depends on the cart.
 * `lang` selects the language of the texts. The default is the language of the default profile.
 */
export function seedLines(products: readonly Product[], lang: Lang = DEFAULT_PROFILE.lang): string[] {
  const profile = { ...DEFAULT_PROFILE, lang };
  const lines: Line[] = [
    ...products.flatMap(promptForms),
    ...FIXED_KEYS.map((key): Line => ({ key })),
    { key: 'device.battery', percent: 20 },
    { key: 'device.battery', percent: 10 },
    ...AIM_HINTS.map((aimHint): Line => ({ key: 'glance.partial', aimHint })),
  ];
  // Two products with one spoken name, pack, and price give one text, and one clip serves both.
  return [...new Set(lines.map((line) => renderLine(line, profile)))];
}

/**
 * Asks for the clip of each text, one at a time. A clip that the cache already holds counts as made.
 * `lang` is the language of the texts. It selects the voice.
 */
export async function makeClips(
  lines: readonly string[], clipUrl: (text: string, lang: Lang) => Promise<string | null>, lang: Lang = DEFAULT_PROFILE.lang,
): Promise<{ made: number; failed: number }> {
  let made = 0;
  for (const text of lines) {
    if ((await clipUrl(text, lang)) !== null) made += 1;
  }
  return { made, failed: lines.length - made };
}
