import type { ServerEvent } from '@glance/shared';
import { admitLine } from './guard';
import type { DropReason, Effect, RuleContext, SessionState, SpeakEffect, Verdict } from './types';
import { inView } from './view';

/**
 * The work of one input. `s` is a private copy of the session state, so a handler can change it in place.
 * `out` collects the effects in the order in which the runtime must run them.
 * `solicited` is true while the handler of an action of the shopper runs. The guard of guard.ts reads it.
 * `verdict` is what the rules did with the intent of this input, or null for each other input.
 */
export type Turn = { s: SessionState; now: number; ctx: RuleContext; out: Effect[]; solicited: boolean; verdict: Verdict | null };

export function emit(turn: Turn, event: ServerEvent): void {
  turn.out.push({ type: 'event', event });
}

/**
 * Speaks a line, if the guard of guard.ts lets it play. Returns 'spoken', or the reason for the drop.
 * A rule that speaks one time for each appearance can try again after 'gap': the next report of its target is a new chance.
 */
export function speak(turn: Turn, effect: SpeakEffect): 'spoken' | DropReason {
  const reason = admitLine(turn, effect);
  if (reason !== null) {
    turn.out.push({ type: 'speak.dropped', line: effect.line, reason });
    return reason;
  }
  turn.out.push(effect);
  return 'spoken';
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
