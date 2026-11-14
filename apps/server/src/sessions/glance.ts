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

/** What the rules of this file know about the source of a product prompt. */
export type SightState = {
  /**
   * The ID of the product prompt that a sure source opened or confirmed, else null. The sure sources are a barcode,
   * a label match, digits of the model, and a still, which has the pixels for the flavor text of a package.
   * An `ambiguous` result of a stream frame does not end such a prompt.
   */
  surePromptId: string | null;
  /** The last result by sight that named another product than the product of the prompt, when no other result followed it. */
  run: { productId: string; at: number } | null;
};

/**
 * The sight state of a session. It lives in the session state as the field `sight`, which only this file reads.
 * A new session, and a session that an older server stored, have none, so this fills it.
 */
export function sightOf(s: SessionState): SightState {
  const state = s as SessionState & { sight?: SightState };
  state.sight ??= { surePromptId: null, run: null };
  return state.sight;
}

type RecognitionInput = Extract<RuleInput, { type: 'recognition' }>;

export function onRecognition(turn: Turn, input: RecognitionInput): void {
  const { s, now, ctx } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const { result } = input;
  if (result.status !== 'none') s.lastTargetAt = now;
  // "In a row": each result that names no product ends the run of `agreesBySight`.
  if (result.status !== 'identified') sightOf(s).run = null;
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
      if (result.productId !== null && agreesBySight(turn, result.productId) && !goesBack(turn, result.productId)) {
        onIdentified(turn, result.productId, input.still);
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

/**
 * False for the first result by sight that names another product than the product of the current prompt.
 * The prompt changes with the second such result in a row for one product, inside SWITCH_WITHIN_MS.
 * In the test of 2026-11-14 a label match named the can in the hand, and 0.5 seconds later one frame named a can
 * on the table behind it. A barcode and a label match are sure, so they do not go through this test.
 */
function agreesBySight(turn: Turn, productId: string): boolean {
  const { s, now } = turn;
  const sight = sightOf(s);
  if (s.prompt?.kind !== 'product' || s.prompt.productId === productId) {
    sight.run = null;
    return true;
  }
  const agrees = sight.run !== null && sight.run.productId === productId && now - sight.run.at <= SWITCH_WITHIN_MS;
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
 * For a product that recognition named, and for the product of a barcode or a label match.
 * `sure` is false for the result of a stream frame. Each other source is sure of its product.
 */
export function onIdentified(turn: Turn, productId: string, sure = true): void {
  const { s, now, ctx } = turn;
  const product = ctx.catalog.get(productId);
  if (!product) return;
  // A sure source names the product of the prompt that sight opened: the prompt is sure from now on.
  if (sure && s.prompt?.kind === 'product' && s.prompt.productId === productId) sightOf(s).surePromptId = s.prompt.id;
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
  if (s.prompt?.kind === 'product' && s.prompt.productId === productId && wasInView) return;
  openProductPrompt(turn, product, sure);
}

function openProductPrompt(turn: Turn, product: Product, sure: boolean): void {
  const { s } = turn;
  if (s.prompt?.kind === 'product') {
    emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
    if (s.prompt.productId !== product.id) s.replaced = { productId: s.prompt.productId, by: product.id };
  }

  suspendCheckoutFor(turn, product.id);

  // The model named one product, so the look-alike appearance is over. A later ambiguous result gets its line again.
  s.ambiguousKey = null;
  s.ambiguousAt = null;

  const id = nextPromptId(s);
  const qty = qtyInCart(s, product.id);
  const mode = qty > 0 ? 'inCart' : 'new';
  const warnings = warningsFor(product, s.profile);
  // A sound never carries information alone: the line names each warning.
  const over = { promptId: id, ...(warnings.length > 0 ? { sound: 'warning' as const } : {}) };
  s.prompt = { id, kind: 'product', mode, productId: product.id, startedAt: turn.now, doneAt: null };
  sightOf(s).surePromptId = sure ? id : null;
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

// The time moves with each ambiguous result, so one appearance gives one line.
function onAmbiguous(turn: Turn, candidates: readonly string[]): void {
  const { s, now, ctx } = turn;
  const products = candidates.flatMap((id) => ctx.catalog.get(id) ?? []);
  if (products.length < 2) return;
  // Sight names candidates now, so the unknown line that waits for a still is out of date.
  endStillWait(s);

  if (s.prompt?.kind === 'product') {
    if (candidates.includes(s.prompt.productId)) {
      // A sure source read the product. A small frame that cannot tell it from its look-alikes says nothing new.
      if (sightOf(s).surePromptId === s.prompt.id) return;
      // The shopper cannot add a product that the model is no longer sure of.
      emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
      s.prompt = null;
    } else if (promptProductInView(s, now)) {
      return;
    }
  }

  const key = products.map((product) => product.id).sort().join(' ');
  const sameAppearance = s.ambiguousKey === key && s.ambiguousAt !== null && now - s.ambiguousAt < TIMING.viewMs;
  s.ambiguousKey = key;
  s.ambiguousAt = now;
  if (sameAppearance) return;

  // The event goes out at once: it is the signal for the phone to take a still.
  emit(turn, { type: 'glance.ambiguous', candidates: products.map((product) => toProductRef(product, s.profile.lang)) });
  if (ctx.secondLookWaitMs > 0) {
    s.heldAmbiguous = { products: products.map((product) => product.id), since: now };
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
