import { type Caption, type CurrentPrompt, type SessionSnapshot, TIMING, toProductRef } from '@glance/shared';
import { needsBiometric } from './checkout';
import type { RuleContext, SessionState } from './types';
import { warningsFor } from './warnings';

const SNAPSHOT_CAPTIONS = 20;

/** A target is in view when its last report is newer than the view time (spec section 6.2, terms). */
export function inView(seenAt: number | undefined, now: number): boolean {
  return seenAt !== undefined && now - seenAt < TIMING.viewMs;
}

/** R9: the products that the next recognition call must not name. */
export function excludeList(state: SessionState, now: number): string[] {
  return state.excluded.filter((entry) => entry.until > now).map((entry) => entry.productId);
}

/** The session as a client sees it when it connects. `captions` is oldest first. */
export function toSnapshot(sessionId: string, state: SessionState, captions: Caption[], ctx: RuleContext): SessionSnapshot {
  return {
    sessionId,
    phase: state.phase,
    cameraOn: state.cameraOn,
    prompt: currentPrompt(state, ctx),
    cart: state.cart,
    profile: state.profile,
    kiosk: state.checkout?.kiosk ?? null,
    lastReceipt: state.lastReceipt,
    captions: captions.slice(-SNAPSHOT_CAPTIONS),
  };
}

function currentPrompt(state: SessionState, ctx: RuleContext): CurrentPrompt | null {
  const prompt = state.prompt;
  if (!prompt) return null;

  if (prompt.kind === 'pay') {
    if (!state.checkout) return null;
    return {
      promptId: prompt.id,
      kind: 'pay',
      kiosk: state.checkout.kiosk,
      totalCents: state.cart.totalCents,
      itemCount: state.cart.items.reduce((count, item) => count + item.qty, 0),
      needsBiometric: needsBiometric(state.cart.totalCents),
    };
  }

  const product = ctx.catalog.get(prompt.productId);
  if (!product) return null;
  return {
    promptId: prompt.id,
    kind: 'product',
    mode: prompt.mode,
    product: toProductRef(product, state.profile.lang),
    warnings: warningsFor(product, state.profile),
    qtyInCart: state.cart.items.find((item) => item.productId === prompt.productId)?.qty ?? 0,
  };
}
