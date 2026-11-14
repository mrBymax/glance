import { DEFAULT_PROFILE, type Lang, type Product } from '@glance/shared';
import type { Line } from '../sessions/types';
import { renderLine } from './render';

/** A line with no parameter has one text for each shopper with the default profile. */
type FixedKey = { [K in Line['key']]: { key: K } extends Extract<Line, { key: K }> ? K : never }[Line['key']];

/** An extra that adds a line with no parameter adds its key here. */
const FIXED_KEYS: readonly FixedKey[] = [
  'session.start', 'session.rest', 'glance.unknown', 'glance.skipped', 'undo.nothing',
  'hint.holdAgain', 'hint.holdAgainForAnother', 'hint.lookAtCode',
  'checkout.empty', 'checkout.busy', 'checkout.cancelled', 'checkout.failed',
  'info.help', 'device.cameraOff', 'device.regularCheckout', 'device.paused',
  'net.backOnline', 'recognition.slow',
  'ask.listening', 'ask.noProduct', 'ask.failed',
];

const AIM_HINTS = ['left', 'right', 'up', 'down', 'closer', 'farther', 'turn'] as const;

/**
 * The texts that the seed makes clips for: the lines that a shop with the default profile is sure to need.
 * A line with a total or an item count is not in the list, because its text depends on the cart.
 */
export function seedLines(products: readonly Product[]): string[] {
  const lines: Line[] = [
    ...products.flatMap((product): Line[] => [
      { key: 'glance.new', product, hint: true, warnings: [] },
      { key: 'glance.new', product, hint: false, warnings: [] },
      { key: 'glance.inCart', product, qty: 1, warnings: [] },
    ]),
    ...FIXED_KEYS.map((key): Line => ({ key })),
    { key: 'device.battery', percent: 20 },
    { key: 'device.battery', percent: 10 },
    ...AIM_HINTS.map((aimHint): Line => ({ key: 'glance.partial', aimHint })),
  ];
  // Two products with one spoken name, pack, and price give one text, and one clip serves both.
  return [...new Set(lines.map((line) => renderLine(line, DEFAULT_PROFILE)))];
}

/** Asks for the clip of each text, one at a time. A clip that the cache already holds counts as made. */
export async function makeClips(
  lines: readonly string[], clipUrl: (text: string, lang: Lang) => Promise<string | null>,
): Promise<{ made: number; failed: number }> {
  let made = 0;
  for (const text of lines) {
    if ((await clipUrl(text, DEFAULT_PROFILE.lang)) !== null) made += 1;
  }
  return { made, failed: lines.length - made };
}
