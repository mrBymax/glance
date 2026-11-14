import { EMPTY_CART, type Receipt, TIMING } from '@glance/shared';
import { say } from './say';
import { type Turn, emit, emitSessionState, itemCount, nextPromptId, speak } from './turn';
import type { RuleInput, SessionState } from './types';
import { inView } from './view';

/** While the mock payment runs, no input changes the cart or the checkout. */
export function isPaying(s: SessionState): boolean {
  return s.checkout?.step === 'paying';
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
      s.kioskSeen.said = true;
      speak(turn, say({ key: input.busy ? 'checkout.busy' : 'checkout.empty' }));
    }
    return;
  }
  s.phase = 'checkout';
  s.checkout = { kiosk, step: 'offered', suspendedBy: null };
  emitSessionState(turn);
  offer(turn, true);
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
  s.prompt = { id, kind: 'pay', kioskId: kiosk.id, doneAt: null };
  emit(turn, { type: 'checkout.offered', promptId: id, kiosk, totalCents, itemCount: count, needsBiometric: false });
  speak(turn, say({ key: 'checkout.offer', kiosk, itemCount: count, totalCents }, { promptId: id, interrupt }));
}

/** R17, for the prompt of a product that the shopper holds up during a checkout. */
export function suspendCheckoutFor(turn: Turn, productId: string): void {
  const checkout = turn.s.checkout;
  if (!checkout || checkout.step === 'paying') return;
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
  const step = s.checkout?.step;
  if (step !== 'offered' && step !== 'suspended') return;
  if (s.cart.items.length > 0) {
    // A suspended checkout gets its prompt with the new total when the code is in view again (R17).
    if (step === 'offered') offer(turn, false);
    return;
  }
  endCheckout(turn);
  // The shopper holds a product up. The next report of the code gives the line for an empty cart.
  if (step === 'suspended') return;
  // The code is still in view, and this line is the one that R15 gives for an empty cart.
  if (s.kioskSeen) s.kioskSeen.said = true;
  speak(turn, say({ key: 'checkout.empty' }));
}

// R16. The runtime starts the mock payment and answers with a payment.result input.
export function startPayment(turn: Turn): void {
  const { s } = turn;
  const checkout = s.checkout;
  if (!checkout) return;
  checkout.step = 'paying';
  s.prompt = null;
  turn.out.push({ type: 'payment.start', kiosk: checkout.kiosk, totalCents: s.cart.totalCents });
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
