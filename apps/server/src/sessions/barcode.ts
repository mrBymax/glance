import { isConfirmed } from './checkout';
import { UNREADABLE_EVERY_MS, codeOf } from './code';
import { onIdentified } from './glance';
import { say } from './say';
import { type Turn, promptProductInView, speak } from './turn';
import type { RuleInput } from './types';
import { inView } from './view';

/**
 * A barcode after its lookup. A product takes the path of a product that recognition named,
 * so one appearance gets one prompt (R1), and a yes adds it at the price of the store.
 * A code that the store does not sell gets one line for each appearance, and never a prompt.
 */
export function onBarcode(turn: Turn, input: Extract<RuleInput, { type: 'barcode' }>): void {
  const { s, now } = turn;
  const { outcome } = input;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  if (outcome.kind === 'invalid') return;

  const code = codeOf(s);
  code.at = now;
  code.acceptedAt = now;
  code.stillsOpen = 0;
  s.lastTargetAt = now;
  // A prompt would suspend the checkout that waits for its payment.
  if (isConfirmed(s)) return;

  if (outcome.kind === 'product') {
    // R9: the shopper just skipped this product. Recognition by sight drops it for the same time.
    if (s.excluded.some((entry) => entry.productId === outcome.productId)) return;
    onIdentified(turn, outcome.productId);
    return;
  }

  // The line waits while the shopper answers the prompt of a product in view. The time does not move, so it plays after.
  if (promptProductInView(s, now)) return;
  const before = code.miss;
  const newAppearance = !before || before.gtin !== outcome.gtin || !inView(before.at, now);
  code.miss = { gtin: outcome.gtin, at: now };
  if (newAppearance) speak(turn, say({ key: 'barcode.notInStore' }));
}

/**
 * A label frame: the still of a package that the phone could not read. The model reads it outside the rules.
 * A read that failed gets the unreadable line. A still with no product in it gets no line.
 */
export function onLabel(turn: Turn, input: Extract<RuleInput, { type: 'label' }>): void {
  const { s, now } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const code = codeOf(s);
  code.at = now;
  s.lastTargetAt = now;
  if (input.read !== 'failed' || isConfirmed(s)) return;
  if (code.unreadableAt !== null && now - code.unreadableAt < UNREADABLE_EVERY_MS) return;
  code.unreadableAt = now;
  speak(turn, say({ key: 'barcode.unreadable' }));
}
