import { type Product, TIMING, toProductRef } from '@glance/shared';
import { isConfirmed, passSpotCheck, suspendCheckoutFor } from './checkout';
import { codeOf, codeQuiet, endStillWait, holdUnknownLine, onFrameCode, onUnnamedProduct, speakUnknown } from './code';
import { say } from './say';
import { type Turn, emit, nextPromptId, promptProductInView, qtyInCart, speak } from './turn';
import type { RuleInput, SessionState } from './types';
import { inView } from './view';
import { warningsFor } from './warnings';

/**
 * The first two glance prompts of a session name the yes input. After them the shopper knows it, and the phrase
 * only makes the prompt longer. The detailed level names it in each prompt.
 */
const YES_HINT_GLANCES = 2;

/**
 * The product that a prompt replaced gets no prompt while sight named the product of that prompt in this time.
 * Two store items that look alike can get their names in turn, frame by frame, and each change would be a new prompt.
 */
export const GO_BACK_AFTER_MS = 1000;

/**
 * A result by sight replaces the prompt of another product only when the result before it named the same product,
 * at most this time earlier. One frame can name a product that stands behind the product in the hand.
 */
export const SWITCH_WITHIN_MS = 1500;

/**
 * With no product prompt, a result by sight opens one only when the result before it named the same product,
 * at most this time earlier. The model gives a name to a blurred frame of a product that it cannot read.
 */
export const OPEN_WITHIN_MS = 1500;

/**
 * The look-alike line plays only when the result before it was `ambiguous` with the same candidates,
 * at most this time earlier.
 */
export const ALIKE_WITHIN_MS = 1500;

/** What the rules of this file know about the results by sight in a row. */
export type SightState = {
  /**
   * The last result by sight that named a product with no prompt, when no other result followed it.
   * An `ambiguous` result that has the product among its candidates does not end it.
   */
  run: { productId: string; at: number } | null;
  /** The last result by sight when it was `ambiguous`: the key of its candidates, as in `ambiguousKey`, and its time. */
  alike: { key: string; at: number } | null;
  /** The look-alike appearance that did not get its line yet: the key of its candidates and the time of its event. */
  alikeOwed: { key: string; since: number } | null;
};

/**
 * The sight state of a session. It lives in the session state as the field `sight`, which only this file reads.
 * A new session has none, and a session that an older server stored has none or one with fewer fields, so this fills it.
 */
export function sightOf(s: SessionState): SightState {
  const state = s as SessionState & { sight?: Partial<SightState> };
  if (state.sight?.alikeOwed === undefined) state.sight = { run: null, alike: null, alikeOwed: null, ...state.sight };
  return state.sight as SightState;
}

type RecognitionInput = Extract<RuleInput, { type: 'recognition' }>;

export function onRecognition(turn: Turn, input: RecognitionInput): void {
  const { s, now, ctx } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const { result } = input;
  if (result.status !== 'none') s.lastTargetAt = now;
  const sight = sightOf(s);
  // "In a row": each result that names no product ends the run of `agreesBySight`. The worker gives the results in
  // the order of their frames, so the result before this one comes from an older frame.
  if (result.status !== 'identified' && !namesRunProduct(result, sight)) sight.run = null;
  if (result.status !== 'ambiguous') sight.alike = null;
  onFrameCode(turn, result.code);

  // The sharp second look. The phone took this still because of a glance.ambiguous event.
  if (input.still && ctx.secondLookWaitMs > 0) {
    const sure = result.status === 'identified' && result.productId !== null && ctx.catalog.get(result.productId) !== undefined;
    if (!sure) {
      // The still did not help, so the shopper hears the line now. Each other part of this result has no effect:
      // a second line, or a second event that asks for one more still, would follow the first one.
      speakHeldAmbiguous(turn);
      return;
    }
  }
  if (result.status === 'none') return;
  // A prompt would suspend the checkout, and the result of the fingerprint check would then have no checkout to pay.
  if (isConfirmed(s)) return;

  switch (result.status) {
    case 'identified':
      if (result.productId !== null && agreesBySight(turn, result.productId, input.still) && !goesBack(turn, result.productId)) {
        onIdentified(turn, result.productId);
      }
      return;
    case 'ambiguous':
      onAmbiguous(turn, result.candidates);
      return;
    case 'unknown':
      onUnknown(turn);
      break;
    case 'unsure':
      onAimHint(turn, result.aimHint);
      break;
  }
  // The still of the second look is a still already, so only a stream frame counts.
  if (!input.still) onUnnamedProduct(turn);
}

/** True for an `ambiguous` result that has the product of the run among its candidates: it names no other product. */
function namesRunProduct(result: RecognitionInput['result'], sight: SightState): boolean {
  return result.status === 'ambiguous' && sight.run !== null && result.candidates.includes(sight.run.productId);
}

/**
 * False for the first result by sight that names a product with no prompt. The prompt opens, or changes, with the
 * second such result in a row for one product, inside OPEN_WITHIN_MS or SWITCH_WITHIN_MS.
 * In the tests of 2026-11-14 a label match named the can in the hand, and 0.5 seconds later one frame named a can
 * on the table behind it. In a later test 4 blurred frames got the name of a can that the shopper did not hold,
 * each among frames with no name, and each opened a prompt.
 * A barcode and a label match are sure, so they do not go through this test. A still has the pixels for the text
 * of a package, so it opens a prompt alone. It does not replace one alone.
 */
function agreesBySight(turn: Turn, productId: string, still: boolean): boolean {
  const { s, now } = turn;
  const sight = sightOf(s);
  const prompt = s.prompt?.kind === 'product' ? s.prompt : null;
  if (prompt?.productId === productId || (prompt === null && still)) {
    sight.run = null;
    return true;
  }
  const within = prompt === null ? OPEN_WITHIN_MS : SWITCH_WITHIN_MS;
  const agrees = sight.run !== null && sight.run.productId === productId && now - sight.run.at <= within;
  // The run stays after it agrees: `goesBack` can still hold the product back, and the next result then counts.
  sight.run = { productId, at: now };
  return agrees;
}

/**
 * True for a result of sight that would give the prompt back to the product that the current prompt replaced, while
 * sight still names the product of the current prompt. A barcode is sure, so it does not go through this test.
 */
function goesBack(turn: Turn, productId: string): boolean {
  const { s, now } = turn;
  if (s.prompt?.kind !== 'product' || s.replaced?.productId !== productId || s.replaced.by !== s.prompt.productId) return false;
  const lastSeen = s.seen[s.prompt.productId];
  return lastSeen !== undefined && now - lastSeen < GO_BACK_AFTER_MS;
}

/**
 * True while the phone can take a head answer for this prompt, on the count of the server: the head window of the
 * profile since `prompt.done`, or since the start of the prompt with no `prompt.done`. A profile with no end of
 * the head window keeps it open. A stall of the motion samples can keep the window of the phone open for longer.
 */
function headWindowOpen(s: SessionState, prompt: NonNullable<SessionState['prompt']>, now: number): boolean {
  if (!s.profile.headGestures) return false;
  const windowMs = s.profile.headWindowMs;
  // A prompt that an older server stored has no start time. Its time starts now.
  const from = prompt.doneAt ?? (prompt as { startedAt?: number }).startedAt ?? now;
  return windowMs === null || now - from < windowMs;
}

/** For a product that recognition named, and for the product of a barcode or a label match. */
export function onIdentified(turn: Turn, productId: string): void {
  const { s, now, ctx } = turn;
  const product = ctx.catalog.get(productId);
  if (!product) return;
  // The model named one product, in a still or in a stream frame, so the look-alike line is out of date.
  s.heldAmbiguous = null;
  // The same for the unknown line that waits for a still.
  endStillWait(s);

  const wasInView = inView(s.seen[productId], now);
  s.seen[productId] = now;
  // Before the mute test: a product that the shopper just added, and still holds, also passes the spot check.
  if (passSpotCheck(turn, productId)) return;
  if (s.muted.includes(productId)) return;
  // R1: results inside the view time belong to one appearance, and one appearance gets one prompt.
  // A product that comes back keeps its prompt while a nod can answer it. In the session of 2026-11-14 a still stopped
  // the frames for 4.7 seconds, the next result opened a second prompt for the held product, and the nod was lost.
  if (s.prompt?.kind === 'product' && s.prompt.productId === productId && (wasInView || headWindowOpen(s, s.prompt, now))) return;
  openProductPrompt(turn, product);
}

function openProductPrompt(turn: Turn, product: Product): void {
  const { s } = turn;
  if (s.prompt?.kind === 'product') {
    emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
    if (s.prompt.productId !== product.id) s.replaced = { productId: s.prompt.productId, by: product.id };
  }

  suspendCheckoutFor(turn, product.id);

  // The model named one product, so the look-alike appearance is over. A later ambiguous result gets its line again.
  s.ambiguousKey = null;
  s.ambiguousAt = null;
  sightOf(s).alikeOwed = null;

  const id = nextPromptId(s);
  const qty = qtyInCart(s, product.id);
  const mode = qty > 0 ? 'inCart' : 'new';
  const warnings = warningsFor(product, s.profile);
  // A sound never carries information alone: the line names each warning.
  const over = { promptId: id, ...(warnings.length > 0 ? { sound: 'warning' as const } : {}) };
  s.prompt = { id, kind: 'product', mode, productId: product.id, startedAt: turn.now, doneAt: null };
  emit(turn, {
    type: 'glance.pending', promptId: id, kind: mode, product: toProductRef(product, s.profile.lang), warnings, qtyInCart: qty,
  });

  if (mode === 'inCart') {
    speak(turn, say({ key: 'glance.inCart', product, qty, warnings }, over));
    return;
  }
  const hint = s.profile.detail === 'detailed' || s.glanceCount < YES_HINT_GLANCES;
  s.glanceCount += 1;
  speak(turn, say({ key: 'glance.new', product, hint, warnings }, over));
}

// R13. The time moves with each unknown result, so one appearance gives one line.
// No line while the shopper shows a barcode: the barcode path speaks then.
// The line of a new appearance waits while a still can name the product. `expireUnknownLine` and `onLabel` speak it later.
function onUnknown(turn: Turn): void {
  const { s, now } = turn;
  if (promptProductInView(s, now) || codeQuiet(s, now)) return;
  if (codeOf(s).unknownHeldAt !== null) return;
  if (s.unknownAt !== null && now - s.unknownAt < TIMING.viewMs) {
    s.unknownAt = now;
    return;
  }
  if (!holdUnknownLine(turn)) speakUnknown(turn);
}

// The time moves with each ambiguous result, so one appearance gives one event and one line.
// The event goes out with the first result. The line needs the second result in a row with the same candidates,
// inside ALIKE_WITHIN_MS: one blurred frame gets candidates as it gets a name.
function onAmbiguous(turn: Turn, candidates: readonly string[]): void {
  const { s, now, ctx } = turn;
  const sight = sightOf(s);
  const products = candidates.flatMap((id) => ctx.catalog.get(id) ?? []);
  if (products.length < 2) {
    sight.alike = null;
    return;
  }
  const key = products.map((product) => product.id).sort().join(' ');
  const inRow = sight.alike !== null && sight.alike.key === key && now - sight.alike.at <= ALIKE_WITHIN_MS;
  sight.alike = { key, at: now };
  // Sight names candidates now, so the unknown line that waits for a still is out of date.
  // The wait for that still goes on: the still is on its way, and no aim hint plays before its answer.
  codeOf(s).unknownHeldAt = null;

  if (s.prompt?.kind === 'product') {
    // The result names no other product, so the prompt stays, and no look-alike line plays over it.
    // A small frame of a store item of one design answers `ambiguous` in most frames.
    if (candidates.includes(s.prompt.productId)) return;
    // Other candidates count as another product: the second result in a row ends the prompt, as in `agreesBySight`.
    if (promptProductInView(s, now) || !inRow) return;
    emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
    s.prompt = null;
  }

  const sameAppearance = s.ambiguousKey === key && s.ambiguousAt !== null && now - s.ambiguousAt < TIMING.viewMs;
  s.ambiguousKey = key;
  s.ambiguousAt = now;
  if (!sameAppearance) {
    // The event goes out at once: it is the signal for the phone to take a still.
    emit(turn, { type: 'glance.ambiguous', candidates: products.map((product) => toProductRef(product, s.profile.lang)) });
    sight.alikeOwed = { key, since: now };
  }
  if (!inRow || sight.alikeOwed?.key !== key) return;

  const { since } = sight.alikeOwed;
  sight.alikeOwed = null;
  if (ctx.secondLookWaitMs > 0) {
    // The wait counts from the event, which asked for the still.
    s.heldAmbiguous = { products: products.map((product) => product.id), since };
    return;
  }
  speak(turn, say({ key: 'glance.ambiguous', products }));
}

/** Speaks the look-alike line that waits for a still, if one waits. */
function speakHeldAmbiguous(turn: Turn): void {
  const { s, ctx } = turn;
  const held = s.heldAmbiguous;
  if (!held) return;
  s.heldAmbiguous = null;
  const products = held.products.flatMap((id) => ctx.catalog.get(id) ?? []);
  if (products.length >= 2) speak(turn, say({ key: 'glance.ambiguous', products }));
}

/** The time rule of the second look. `expire` of step.ts runs it before each input. */
export function expireSecondLook(turn: Turn): void {
  const { s, now, ctx } = turn;
  if (!s.heldAmbiguous) return;
  // No line for a session that stopped, that rests, or that pays.
  if ((s.phase !== 'shopping' && s.phase !== 'checkout') || isConfirmed(s)) {
    s.heldAmbiguous = null;
    return;
  }
  if (now - s.heldAmbiguous.since >= ctx.secondLookWaitMs) speakHeldAmbiguous(turn);
}

function onAimHint(turn: Turn, aimHint: RecognitionInput['result']['aimHint']): void {
  const { s, now } = turn;
  if (aimHint === 'none') return;
  // A shopper who shows a barcode must not hear "Turn the front to me."
  if (promptProductInView(s, now) || codeQuiet(s, now)) return;
  if (s.aimHintAt !== null && now - s.aimHintAt < TIMING.aimHintEveryMs) return;
  s.aimHintAt = now;
  emit(turn, { type: 'glance.hint', aimHint });
  speak(turn, say({ key: 'glance.partial', aimHint }));
}
