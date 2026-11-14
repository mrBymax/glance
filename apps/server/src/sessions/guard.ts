import { TIMING } from '@glance/shared';
import { renderLine } from '../speech/render';
import type { Turn } from './turn';
import type { DropReason, Line, RuleInput, SessionState, SpeakEffect, VoiceState } from './types';

/** An unsolicited line with the same text is not spoken again in this time. */
export const SAME_TEXT_MS = 20_000;
/** Two unsolicited lines are this time apart. A later line inside it is dropped, and never spoken later. */
export const UNSOLICITED_GAP_MS = 3000;
/** The view must be empty for this time before the voice speaks again about a read that failed. */
export const APPEARANCE_EMPTY_MS = TIMING.viewMs;

/**
 * The inputs that are an action of the shopper: an answer, a command, a cart edit, a setting, a question,
 * the answer of the model to that question, and the fingerprint check.
 */
const SHOPPER_ACTIONS: ReadonlySet<RuleInput['type']> = new Set(['intent', 'cart.edit', 'profile.set', 'question', 'answer', 'biometric.result']);

/**
 * The one definition of "solicited": the handler of an action of the shopper spoke the line, in the step of that action.
 * Each other line is unsolicited: a line for a recognition result, a barcode, a label frame, a kiosk code, a device
 * state, a socket, or a payment result, and each line of a time rule, also when the time rule runs in the step of an action.
 */
export function isSolicited(input: RuleInput['type']): boolean {
  return SHOPPER_ACTIONS.has(input);
}

/**
 * What an unsolicited line is, for the guard.
 * prompt, checkout, state: the shopper must hear the line, so it always plays.
 * attempt: the voice says that a read in the background failed. One appearance of a product or a code gets one such line.
 * other: each other line.
 */
export type LineKind = 'prompt' | 'checkout' | 'state' | 'attempt' | 'other';

export const LINE_KIND: Record<Line['key'], LineKind> = {
  'session.start': 'state',
  'session.rest': 'state',
  'glance.new': 'prompt',
  'glance.inCart': 'prompt',
  'glance.unknown': 'attempt',
  'glance.ambiguous': 'other',
  'glance.partial': 'other',
  'glance.skipped': 'other',
  'cart.added': 'other',
  'cart.removed': 'other',
  'undo.nothing': 'other',
  'hint.lookAtCode': 'other',
  'checkout.offer': 'checkout',
  // The line of a kiosk code that starts no checkout. It names no payment, so it is no checkout line for the guard.
  'checkout.empty': 'other',
  'checkout.busy': 'other',
  'checkout.cancelled': 'checkout',
  'checkout.paid': 'checkout',
  'checkout.failed': 'checkout',
  'checkout.biometric': 'checkout',
  'spotcheck.ask': 'checkout',
  'spotcheck.thanks': 'checkout',
  'info.total': 'other',
  'info.cart': 'other',
  'info.help': 'other',
  'device.cameraOff': 'state',
  'device.regularCheckout': 'state',
  'device.paused': 'state',
  'device.battery': 'state',
  'net.backOnline': 'state',
  'recognition.slow': 'other',
  'ask.listening': 'other',
  'ask.noProduct': 'other',
  'ask.failed': 'other',
  'ask.answer': 'other',
  'barcode.notInStore': 'other',
  'barcode.unreadable': 'attempt',
};

const ALWAYS: ReadonlySet<LineKind> = new Set(['prompt', 'checkout', 'state']);

export function newVoiceState(): VoiceState {
  return { recent: [], unsolicitedAt: null, sightAt: null, attemptSaid: false };
}

/** The voice state of a session. A session that an older server stored has none, so this fills it. */
function voiceOf(s: SessionState): VoiceState {
  if ((s as { voice?: VoiceState }).voice === undefined) s.voice = newVoiceState();
  return s.voice;
}

/** True when the input shows a product or a code in view: the view is not empty. */
function isSight(input: RuleInput): boolean {
  switch (input.type) {
    case 'recognition':
      return input.result.status !== 'none' || input.result.code.visible;
    case 'barcode':
      return true;
    // An empty still showed no product.
    case 'label':
      return input.read !== 'empty';
    default:
      return false;
  }
}

/**
 * Runs before the rules of each input. An appearance ends when the view was empty for the view time:
 * no product, no code, and no label frame. The next read that fails can then get its line again.
 */
export function noteSight(turn: Turn, input: RuleInput): void {
  const voice = voiceOf(turn.s);
  voice.recent = voice.recent.filter((line) => turn.now - line.at < SAME_TEXT_MS);
  if (voice.sightAt !== null && turn.now - voice.sightAt >= APPEARANCE_EMPTY_MS) voice.attemptSaid = false;
  if (isSight(input)) voice.sightAt = turn.now;
}

/**
 * The guard against a voice that repeats itself. `speak` of turn.ts asks it for each line.
 * Returns null for a line that plays, and then counts the line as spoken. Else it returns the reason for the drop.
 *
 * A solicited line always plays (`turn.solicited`, see `isSolicited`). For an unsolicited line:
 * - A product prompt, a checkout line, and a state line always play.
 * - A line about a read that failed plays one time for each appearance of a product or a code.
 * - A line with the text of a line of the last 20 seconds is dropped.
 * - A line less than 3 seconds after another unsolicited line is dropped.
 * The sound of a dropped line goes with it, and no later step speaks the line by itself.
 */
export function admitLine(turn: Turn, effect: SpeakEffect): DropReason | null {
  const { s, now } = turn;
  const voice = voiceOf(s);
  const text = renderLine(effect.line, s.profile);
  const kind = LINE_KIND[effect.line.key];

  if (!turn.solicited && !ALWAYS.has(kind)) {
    if (kind === 'attempt' && voice.attemptSaid) return 'appearance';
    if (voice.recent.some((line) => line.text === text)) return 'same text';
    if (voice.unsolicitedAt !== null && now - voice.unsolicitedAt < UNSOLICITED_GAP_MS) return 'gap';
  }

  voice.recent.push({ text, at: now });
  if (!turn.solicited) voice.unsolicitedAt = now;
  if (kind === 'attempt') voice.attemptSaid = true;
  // A named product is a new appearance: the shopper holds another product now.
  if (kind === 'prompt') voice.attemptSaid = false;
  return null;
}
