import { type Product, TIMING, toProductRef } from '@glance/shared';
import { isConfirmed, passSpotCheck, suspendCheckoutFor } from './checkout';
import { codeOf, codeQuiet, endStillWait, holdUnknownLine, onFrameCode, onUnnamedProduct, speakUnknown } from './code';
import { say } from './say';
import { type Turn, emit, nextPromptId, promptProductInView, qtyInCart, speak } from './turn';
import type { RuleInput } from './types';
import { inView } from './view';
import { warningsFor } from './warnings';

/** Spec section 6.1: the first three glance prompts of a session name the yes input. */
const YES_HINT_GLANCES = 3;

type RecognitionInput = Extract<RuleInput, { type: 'recognition' }>;

export function onRecognition(turn: Turn, input: RecognitionInput): void {
  const { s, now, ctx } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const { result } = input;
  if (result.status !== 'none') s.lastTargetAt = now;
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
      if (result.productId !== null) onIdentified(turn, result.productId);
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

/** For a product that recognition named, and for the product of a barcode. */
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
  if (s.prompt?.kind === 'product' && s.prompt.productId === productId && wasInView) return;
  openProductPrompt(turn, product);
}

function openProductPrompt(turn: Turn, product: Product): void {
  const { s } = turn;
  if (s.prompt?.kind === 'product') emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });

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
  s.prompt = { id, kind: 'product', mode, productId: product.id, doneAt: null };
  emit(turn, {
    type: 'glance.pending', promptId: id, kind: mode, product: toProductRef(product, s.profile.lang), warnings, qtyInCart: qty,
  });

  if (mode === 'inCart') {
    speak(turn, say({ key: 'glance.inCart', product, qty, warnings }, over));
    return;
  }
  const hint = s.glanceCount < YES_HINT_GLANCES;
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
