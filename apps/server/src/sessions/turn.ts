import type { ServerEvent } from '@glance/shared';
import type { Effect, RuleContext, SessionState, SpeakEffect } from './types';
import { inView } from './view';

/**
 * The work of one input. `s` is a private copy of the session state, so a handler can change it in place.
 * `out` collects the effects in the order in which the runtime must run them.
 */
export type Turn = { s: SessionState; now: number; ctx: RuleContext; out: Effect[] };

export function emit(turn: Turn, event: ServerEvent): void {
  turn.out.push({ type: 'event', event });
}

export function speak(turn: Turn, effect: SpeakEffect): void {
  turn.out.push(effect);
}

/** Counts the prompt and returns its ID, for example "p-0001". */
export function nextPromptId(s: SessionState): string {
  s.promptSeq += 1;
  return `p-${String(s.promptSeq).padStart(4, '0')}`;
}

export function emitSessionState(turn: Turn): void {
  emit(turn, { type: 'session.state', phase: turn.s.phase, cameraOn: turn.s.cameraOn });
}

export function qtyInCart(s: SessionState, productId: string): number {
  return s.cart.items.find((item) => item.productId === productId)?.qty ?? 0;
}

/** The number of units in the cart. */
export function itemCount(s: SessionState): number {
  return s.cart.items.reduce((count, item) => count + item.qty, 0);
}

/** True while the product of the current prompt is in view. */
export function promptProductInView(s: SessionState, now: number): boolean {
  return s.prompt?.kind === 'product' && inView(s.seen[s.prompt.productId], now);
}
