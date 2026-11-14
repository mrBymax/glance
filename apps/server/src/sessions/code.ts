import type { FrameCode } from '../recognition/result';
import { isConfirmed } from './checkout';
import type { Turn } from './turn';
import type { CodeState, SessionState } from './types';

/** "One voice": recognition by sight gives no unknown line and no aim hint for this time after a sign of a barcode. */
export const CODE_QUIET_MS = 3000;
/** The model must see a code in 2 frames inside this time before the server asks for a still. */
export const CODE_FRAMES_WITHIN_MS = 2000;
/** No still while a code was read inside this time. */
export const CODE_ACCEPTED_MS = 3000;
/** A still can stop Motion on the glasses for a moment, so a session asks for one at most one time in this time. */
export const STILL_REQUEST_EVERY_MS = 6000;
/** After this count of requests with no code read, the phone and the model cannot read the code that the model sees. */
export const STILLS_BEFORE_WAIT = 2;
/** The time between two requests after that count. A code that was read brings the 6 seconds back. */
export const STILL_REQUEST_WAIT_MS = 30000;
/** The voice says at most one time in this time that it cannot read a code. */
export const UNREADABLE_EVERY_MS = 10000;

export function newCodeState(): CodeState {
  return { at: null, visibleAt: null, acceptedAt: null, stillRequestAt: null, stillsOpen: 0, unreadableAt: null, miss: null };
}

/** The code state of a session. A session that an older server stored has none, so this makes it. */
export function codeOf(s: SessionState): CodeState {
  (s as { code?: CodeState }).code ??= newCodeState();
  return s.code;
}

/** True while the shopper shows a barcode, and for 3 seconds after. */
export function codeQuiet(s: SessionState, now: number): boolean {
  const at = (s as { code?: CodeState }).code?.at ?? null;
  return at !== null && now - at < CODE_QUIET_MS;
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
  if (isConfirmed(s)) return;
  if (state.acceptedAt !== null && now - state.acceptedAt < CODE_ACCEPTED_MS) return;
  // A barcode on a shelf label, or one that is too far away, stays in view. Without the long wait it would get a still each 6 seconds.
  const every = state.stillsOpen >= STILLS_BEFORE_WAIT ? STILL_REQUEST_WAIT_MS : STILL_REQUEST_EVERY_MS;
  if (state.stillRequestAt !== null && now - state.stillRequestAt < every) return;
  state.stillRequestAt = now;
  state.stillsOpen += 1;
  turn.out.push({ type: 'still.request' });
}
