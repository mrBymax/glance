import { type Product, TIMING, toProductRef } from '@glance/shared';
import { isPaying, suspendCheckoutFor } from './checkout';
import { say } from './say';
import { type Turn, emit, nextPromptId, promptProductInView, qtyInCart, speak } from './turn';
import type { RuleInput } from './types';
import { inView } from './view';
import { warningsFor } from './warnings';

/** Spec section 6.1: the first three glance prompts of a session name the yes input. */
const YES_HINT_GLANCES = 3;

type RecognitionInput = Extract<RuleInput, { type: 'recognition' }>;

export function onRecognition(turn: Turn, input: RecognitionInput): void {
  const { s, now } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const { result } = input;
  if (result.status === 'none') return;
  s.lastTargetAt = now;
  if (isPaying(s)) return;

  switch (result.status) {
    case 'identified':
      if (result.productId !== null) onIdentified(turn, result.productId);
      return;
    case 'unknown':
      onUnknown(turn);
      return;
    case 'unsure':
      onAimHint(turn, result.aimHint);
      return;
    case 'ambiguous':
      onAmbiguous(turn, result.candidates);
      return;
  }
}

function onIdentified(turn: Turn, productId: string): void {
  const { s, now, ctx } = turn;
  const product = ctx.catalog.get(productId);
  if (!product) return;

  const wasInView = inView(s.seen[productId], now);
  s.seen[productId] = now;
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
function onUnknown(turn: Turn): void {
  const { s, now } = turn;
  if (promptProductInView(s, now)) return;
  if (s.unknownAt === null || now - s.unknownAt >= TIMING.viewMs) {
    emit(turn, { type: 'glance.unknown' });
    speak(turn, say({ key: 'glance.unknown' }));
  }
  s.unknownAt = now;
}

// The time moves with each ambiguous result, so one appearance gives one line.
function onAmbiguous(turn: Turn, candidates: readonly string[]): void {
  const { s, now, ctx } = turn;
  const products = candidates.flatMap((id) => ctx.catalog.get(id) ?? []);
  if (products.length < 2) return;

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

  emit(turn, { type: 'glance.ambiguous', candidates: products.map((product) => toProductRef(product, s.profile.lang)) });
  speak(turn, say({ key: 'glance.ambiguous', products }));
}

function onAimHint(turn: Turn, aimHint: RecognitionInput['result']['aimHint']): void {
  const { s, now } = turn;
  if (aimHint === 'none') return;
  if (promptProductInView(s, now)) return;
  if (s.aimHintAt !== null && now - s.aimHintAt < TIMING.aimHintEveryMs) return;
  s.aimHintAt = now;
  emit(turn, { type: 'glance.hint', aimHint });
  speak(turn, say({ key: 'glance.partial', aimHint }));
}
