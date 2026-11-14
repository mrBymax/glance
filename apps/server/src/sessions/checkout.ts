import { EMPTY_CART, type Product, type Receipt, TIMING, toProductRef } from '@glance/shared';
import { say } from './say';
import { type Turn, emit, emitSessionState, itemCount, nextPromptId, speak } from './turn';
import type { RuleInput, SessionState } from './types';
import { inView } from './view';

/** A payment above this total needs a fingerprint on the phone (spec section 13). */
export const BIOMETRIC_ABOVE_CENTS = 5000;

export function needsBiometric(totalCents: number): boolean {
  return totalCents > BIOMETRIC_ABOVE_CENTS;
}

/** While the mock payment runs, no input changes the cart or the checkout. */
export function isPaying(s: SessionState): boolean {
  return s.checkout?.step === 'paying';
}

/** True from the yes on the pay prompt to the end of the payment. No answer and no cart change counts in that time. */
export function isConfirmed(s: SessionState): boolean {
  return s.checkout?.step === 'biometric' || s.checkout?.step === 'paying';
}

export function onKioskSeen(turn: Turn, input: Extract<RuleInput, { type: 'kiosk.seen' }>): void {
  const { s, now } = turn;
  if (s.phase !== 'shopping' && s.phase !== 'checkout') return;
  const { kiosk } = input;

  const before = s.kioskSeen;
  const newAppearance = !before || before.kioskId !== kiosk.id || !inView(before.at, now);
  s.kioskSeen = { kioskId: kiosk.id, at: now, said: newAppearance ? false : before.said };
  s.lastTargetAt = now;

  if (s.checkout) {
    if (s.checkout.kiosk.id === kiosk.id) onCheckoutKioskSeen(turn, newAppearance);
    return;
  }

  // R15.
  if (s.mutedKioskId === kiosk.id || s.prompt?.kind === 'product') return;
  if (input.busy || s.cart.items.length === 0) {
    if (!s.kioskSeen.said) {
      // A line that came too close to another line gets a new chance with the next report of the code, one second later.
      if (speak(turn, say({ key: input.busy ? 'checkout.busy' : 'checkout.empty' })) === 'gap') return;
      s.kioskSeen.said = true;
      if (input.busy) emit(turn, { type: 'error', code: 'kiosk.busy', message: 'This checkout is busy.' });
    }
    return;
  }
  s.phase = 'checkout';
  const spotProduct = input.spotCheck ? spotCheckProduct(turn) : null;
  s.checkout = { kiosk, step: spotProduct ? 'spotcheck' : 'offered', suspendedBy: null, spotProductId: null };
  emitSessionState(turn);
  if (spotProduct) askSpotCheck(turn, spotProduct);
  else offer(turn, true);
}

/** The cart line with the highest unit price. The first line wins a tie. null when the catalog holds no product of the cart. */
function spotCheckProduct(turn: Turn): Product | null {
  let best: Product | null = null;
  let bestCents = -1;
  for (const item of turn.s.cart.items) {
    if (item.unitPriceCents <= bestCents) continue;
    const product = turn.ctx.catalog.get(item.productId);
    if (!product) continue;
    best = product;
    bestCents = item.unitPriceCents;
  }
  return best;
}

function askSpotCheck(turn: Turn, product: Product): void {
  const { s } = turn;
  s.checkout!.spotProductId = product.id;
  emit(turn, { type: 'checkout.spotcheck', product: toProductRef(product, s.profile.lang) });
  speak(turn, say({ key: 'spotcheck.ask', product }));
}

/**
 * For an identified product. True when it is the product of the spot check, which then gets no prompt.
 * The step `suspended` with no product lets the next report of the code give the pay prompt.
 */
export function passSpotCheck(turn: Turn, productId: string): boolean {
  const { s } = turn;
  const checkout = s.checkout;
  if (checkout?.step !== 'spotcheck' || checkout.spotProductId !== productId) return false;
  checkout.step = 'suspended';
  checkout.suspendedBy = null;
  checkout.spotProductId = null;
  // No prompt for the shown product until it has left the view.
  if (!s.muted.includes(productId)) s.muted.push(productId);
  speak(turn, say({ key: 'spotcheck.thanks' }));
  return true;
}

function onCheckoutKioskSeen(turn: Turn, newAppearance: boolean): void {
  const { s, now } = turn;
  const checkout = s.checkout!;

  if (checkout.step === 'suspended') {
    // R17: the pay prompt returns when the product has left the view and the code is in view.
    if (checkout.suspendedBy !== null && inView(s.seen[checkout.suspendedBy], now)) return;
    if (s.prompt?.kind === 'product') {
      emit(turn, { type: 'glance.cleared', promptId: s.prompt.id });
      s.prompt = null;
    }
    checkout.step = 'offered';
    checkout.suspendedBy = null;
    offer(turn, true);
    return;
  }

  if (checkout.step === 'offered' && newAppearance) {
    // The spec does not state this rule (Plan 1 Task 5, rules 7a and 7b). A shopper who waited longer than the
    // head window looks away and back at the code, and gets a prompt that a nod can answer.
    const prompt = s.prompt;
    const windowMs = s.profile.headWindowMs;
    const headWindowOver = prompt !== null && prompt.doneAt !== null && windowMs !== null && now - prompt.doneAt >= windowMs;
    if (prompt === null || headWindowOver) offer(turn, true);
  }
}

/** Makes a pay prompt with a new ID, so that an answer to an older pay prompt cannot pay (R3). */
function offer(turn: Turn, interrupt: boolean): void {
  const { s } = turn;
  const { kiosk } = s.checkout!;
  const id = nextPromptId(s);
  const count = itemCount(s);
  const totalCents = s.cart.totalCents;
  s.prompt = { id, kind: 'pay', kioskId: kiosk.id, startedAt: turn.now, doneAt: null };
  emit(turn, {
    type: 'checkout.offered', promptId: id, kiosk, totalCents, itemCount: count, needsBiometric: needsBiometric(totalCents),
  });
  speak(turn, say({ key: 'checkout.offer', kiosk, itemCount: count, totalCents }, { promptId: id, interrupt }));
}

/** R17, for the prompt of a product that the shopper holds up during a checkout. A spot check stays open. */
export function suspendCheckoutFor(turn: Turn, productId: string): void {
  const checkout = turn.s.checkout;
  if (!checkout || checkout.step === 'paying' || checkout.step === 'biometric' || checkout.step === 'spotcheck') return;
  if (checkout.step === 'offered') emit(turn, { type: 'checkout.suspended' });
  checkout.step = 'suspended';
  checkout.suspendedBy = productId;
}

/**
 * The pay prompt on the phone shows the total, so a cart change needs a new prompt with the new total.
 * R15: a checkout needs items in the cart, so an empty cart ends it.
 */
export function afterCartChange(turn: Turn): void {
  const { s } = turn;
  const checkout = s.checkout;
  const step = checkout?.step;
  if (!checkout || (step !== 'offered' && step !== 'suspended' && step !== 'spotcheck')) return;
  if (s.cart.items.length > 0) {
    // A suspended checkout gets its prompt with the new total when the code is in view again (R17).
    if (step === 'offered') offer(turn, false);
    // The shopper cannot show a product that left the cart, so the spot check asks for another one.
    if (step === 'spotcheck' && !s.cart.items.some((item) => item.productId === checkout.spotProductId)) {
      const product = spotCheckProduct(turn);
      if (product) {
        askSpotCheck(turn, product);
      } else {
        checkout.step = 'suspended';
        checkout.spotProductId = null;
      }
    }
    return;
  }
  endCheckout(turn);
  // The shopper holds a product up, or shows one. The next report of the code gives the line for an empty cart.
  if (step !== 'offered') return;
  // The code is still in view, and this line is the one that R15 gives for an empty cart.
  if (s.kioskSeen) s.kioskSeen.said = true;
  speak(turn, say({ key: 'checkout.empty' }));
}

/**
 * R16, for an accepted yes on the pay prompt. A total above the limit first needs the fingerprint check of the phone.
 * The runtime starts the mock payment and answers with a payment.result input.
 */
export function startPayment(turn: Turn): void {
  const { s } = turn;
  const checkout = s.checkout;
  if (!checkout) return;
  s.prompt = null;
  if (needsBiometric(s.cart.totalCents)) {
    checkout.step = 'biometric';
    speak(turn, say({ key: 'checkout.biometric' }));
    turn.out.push({ type: 'biometric.request' });
    return;
  }
  pay(turn);
}

function pay(turn: Turn): void {
  const { s } = turn;
  const checkout = s.checkout!;
  checkout.step = 'paying';
  turn.out.push({ type: 'payment.start', kiosk: checkout.kiosk, totalCents: s.cart.totalCents });
}

/** A result counts only while the checkout waits for it. A failed check ends the checkout as a no does (R18). */
export function onBiometricResult(turn: Turn, input: Extract<RuleInput, { type: 'biometric.result' }>): void {
  if (turn.s.checkout?.step !== 'biometric') return;
  if (input.ok) pay(turn);
  else cancelCheckout(turn);
}

// R18.
export function cancelCheckout(turn: Turn): void {
  const { s } = turn;
  if (!s.checkout) return;
  s.mutedKioskId = s.checkout.kiosk.id;
  endCheckout(turn);
  speak(turn, say({ key: 'checkout.cancelled' }));
}

/** Removes the checkout and its pay prompt from the state. The caller sends the events. */
export function closeCheckout(s: SessionState): void {
  s.checkout = null;
  if (s.prompt?.kind === 'pay') s.prompt = null;
  if (s.phase === 'checkout') s.phase = 'shopping';
}

function endCheckout(turn: Turn): void {
  closeCheckout(turn.s);
  emit(turn, { type: 'checkout.cancelled' });
  emitSessionState(turn);
}

/** The time rules of the checkout. `expire` of step.ts runs them before each input. */
export function expireCheckout(turn: Turn): void {
  const { s, now } = turn;
  // R18: the kiosk is muted until its code has left the view.
  if (s.mutedKioskId !== null && !(s.kioskSeen?.kioskId === s.mutedKioskId && inView(s.kioskSeen.at, now))) {
    s.mutedKioskId = null;
  }
  // R19. The server cannot tell if the checkout screen of the phone is open, so the time decides alone.
  // It also ends a checkout that waits for the fingerprint, and one that waits for the product of a spot check.
  if (s.checkout && !isPaying(s) && (!s.kioskSeen || now - s.kioskSeen.at >= TIMING.kioskIdleMs)) {
    endCheckout(turn);
    speak(turn, say({ key: 'checkout.cancelled' }));
  }
}

export function onPaymentResult(turn: Turn, input: Extract<RuleInput, { type: 'payment.result' }>): void {
  const { s } = turn;
  if (!s.checkout || !isPaying(s)) return;
  const { kiosk } = s.checkout;

  if (!input.ok) {
    // The shopper must look at the code again, so a payment that fails cannot start again by itself.
    s.mutedKioskId = kiosk.id;
    closeCheckout(s);
    emit(turn, { type: 'checkout.failed', reason: 'declined' });
    emitSessionState(turn);
    speak(turn, say({ key: 'checkout.failed' }));
    return;
  }

  const receipt: Receipt = {
    orderId: input.orderId, totalCents: s.cart.totalCents, paidAt: input.paidAt, items: s.cart.items, kiosk,
  };
  s.lastReceipt = receipt;
  s.checkout = null;
  s.prompt = null;
  s.phase = 'paid';
  s.cameraOn = false;
  s.cart = EMPTY_CART;
  s.adds = [];
  s.lastAdd = null;
  emit(turn, { type: 'checkout.paid', ...receipt });
  emit(turn, { type: 'cart.updated', cart: EMPTY_CART, change: null });
  emitSessionState(turn);
  speak(turn, say({ key: 'checkout.paid', totalCents: receipt.totalCents }));
  turn.out.push({ type: 'session.end' });
}
