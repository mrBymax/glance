import { TIMING } from '@glance/shared';
import { BARCODE_LOOKUP_MS } from '../products/resolver';
import type { FrameCode } from '../recognition/result';
import { isConfirmed } from './checkout';
import { say } from './say';
import { type Turn, emit, promptProductInView, speak } from './turn';
import type { CodeState, SessionState } from './types';

/** "One voice": recognition by sight gives no unknown line and no aim hint for this time after a sign of a barcode. */
export const CODE_QUIET_MS = 3000;
/**
 * The model must see a code in 2 frames inside this time before the server asks for a still.
 * The same time counts for 2 frames with a product that sight cannot name.
 */
export const CODE_FRAMES_WITHIN_MS = 2000;
/** No still while a code or a product was accepted inside this time. */
export const CODE_ACCEPTED_MS = 3000;
/** A still can stop Motion on the glasses for a moment, so a session asks for one at most one time in this time. */
export const STILL_REQUEST_EVERY_MS = 6000;
/** After this count of requests with no code read, the phone and the model cannot read the code that the model sees. */
export const STILLS_BEFORE_WAIT = 2;
/** The time between two requests after that count. A code that was read brings the 6 seconds back. */
export const STILL_REQUEST_WAIT_MS = 30000;
/**
 * The voice of recognition waits this time for the label frame of a still request. The glasses need 2.3 to 2.9 seconds
 * for a still (measured on 2026-11-14), and the upload follows. A phone that takes no still sends nothing.
 */
export const STILL_ANSWER_MS = 5000;
/** The voice of recognition waits this time for the end of a label call: the time of the call, and the lookup of its item. */
export const LABEL_ANSWER_MS = TIMING.recognitionTimeoutMs + BARCODE_LOOKUP_MS;

export function newCodeState(): CodeState {
  return {
    at: null, visibleAt: null, acceptedAt: null, stillRequestAt: null, stillsOpen: 0, miss: null,
    heldAt: null, waitUntil: null, unknownHeldAt: null,
  };
}

/** The code state of a session. A session that an older server stored has none, or one with fewer fields, so this fills it. */
export function codeOf(s: SessionState): CodeState {
  const stored = (s as { code?: Partial<CodeState> }).code;
  if (stored === undefined || stored.unknownHeldAt === undefined) s.code = { ...newCodeState(), ...stored };
  return s.code;
}

/**
 * True while the barcode path has the voice: the shopper shows a barcode, and for 3 seconds after,
 * and while the server waits for the still that it asked for, or for the label call of that still.
 */
export function codeQuiet(s: SessionState, now: number): boolean {
  const code = (s as { code?: Partial<CodeState> }).code;
  const at = code?.at ?? null;
  const waitUntil = code?.waitUntil ?? null;
  return (at !== null && now - at < CODE_QUIET_MS) || (waitUntil !== null && now < waitUntil);
}

/** The limits that each still request has. They do not depend on the reason for the still. */
function stillAllowed(s: SessionState, now: number): boolean {
  if (isConfirmed(s)) return false;
  const state = codeOf(s);
  if (state.acceptedAt !== null && now - state.acceptedAt < CODE_ACCEPTED_MS) return false;
  // A barcode on a shelf label, or one that is too far away, stays in view. Without the long wait it would get a still each 6 seconds.
  const every = state.stillsOpen >= STILLS_BEFORE_WAIT ? STILL_REQUEST_WAIT_MS : STILL_REQUEST_EVERY_MS;
  return state.stillRequestAt === null || now - state.stillRequestAt >= every;
}

function requestStill(turn: Turn): void {
  const state = codeOf(turn.s);
  state.stillRequestAt = turn.now;
  state.stillsOpen += 1;
  state.waitUntil = turn.now + STILL_ANSWER_MS;
  turn.out.push({ type: 'still.request' });
}

/**
 * For the code of each recognition result. The uploaded frame is small, so the model often sees a barcode and cannot
 * read its digits. Then the phone must take a still, which has more pixels.
 * The digits of a result go to the lookup outside the rules, and come back as a `barcode` input.
 */
export function onFrameCode(turn: Turn, code: FrameCode): void {
  const { s, now } = turn;
  if (!code.visible) return;
  const state = codeOf(s);
  state.at = now;
  s.lastTargetAt = now;

  const before = state.visibleAt;
  state.visibleAt = now;
  if (before === null || now - before >= CODE_FRAMES_WITHIN_MS) return;
  if (stillAllowed(s, now)) requestStill(turn);
}

/** True when a still can help with a product that sight cannot name: the limits allow one, and sight named no product just now. */
function stillCanName(s: SessionState, now: number): boolean {
  return stillAllowed(s, now) && !Object.values(s.seen).some((at) => now - at < CODE_ACCEPTED_MS);
}

/**
 * For each stream frame with the status `unknown` or `unsure`: a hand holds a product that sight cannot name.
 * The label call can read the package text in a still, also with no barcode in view. So 2 such frames
 * inside 2 seconds ask the phone for a still, with the limits of a still for a code.
 */
export function onUnnamedProduct(turn: Turn): void {
  const { s, now } = turn;
  const state = codeOf(s);
  const before = state.heldAt;
  state.heldAt = now;
  if (before === null || now - before >= CODE_FRAMES_WITHIN_MS) return;
  if (stillCanName(s, now)) requestStill(turn);
}

/**
 * The line "I do not know this product." of a new appearance. It waits while a still can still name the product:
 * returns true when the line waits, and false when the caller must speak it now.
 */
export function holdUnknownLine(turn: Turn): boolean {
  const { s, now } = turn;
  if (!stillCanName(s, now)) return false;
  codeOf(s).unknownHeldAt = now;
  return true;
}

export function speakUnknown(turn: Turn): void {
  emit(turn, { type: 'glance.unknown' });
  speak(turn, say({ key: 'glance.unknown' }));
  turn.s.unknownAt = turn.now;
}

/** Drops the unknown line that waits, and ends the wait for a still: a code or a product has the voice now. */
export function endStillWait(s: SessionState): void {
  const state = codeOf(s);
  state.waitUntil = null;
  state.unknownHeldAt = null;
}

/**
 * The time rule of the unknown line that waits. `expire` of step.ts runs it before each input.
 * The line plays when 2 seconds passed with no still request, or when the wait for the still and its label call ended
 * with no answer. A phone that takes no still, and a session with no phone, send no label frame.
 */
export function expireUnknownLine(turn: Turn): void {
  const { s, now } = turn;
  const state = (s as { code?: Partial<CodeState> }).code;
  const heldAt = state?.unknownHeldAt ?? null;
  if (state === undefined || heldAt === null) return;
  // No line for a session that stopped, that rests, or that pays.
  if ((s.phase !== 'shopping' && s.phase !== 'checkout') || isConfirmed(s)) {
    state.unknownHeldAt = null;
    return;
  }
  if (now - heldAt < CODE_FRAMES_WITHIN_MS) return;
  if (state.waitUntil != null && now < state.waitUntil) return;
  state.unknownHeldAt = null;
  // A barcode in view, or the product of a prompt in view, has the voice.
  if (promptProductInView(s, now) || codeQuiet(s, now)) return;
  speakUnknown(turn);
}
