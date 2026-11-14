import { type Caption, type CurrentPrompt, type SessionSnapshot, TIMING, toProductRef } from '@glance/shared';
import { needsBiometric } from './checkout';
import type { FrameState, RuleContext, SessionState } from './types';
import { warningsFor } from './warnings';

const SNAPSHOT_CAPTIONS = 20;

/** A target is in view when its last report is newer than the view time (spec section 6.2, terms). */
export function inView(seenAt: number | undefined, now: number): boolean {
  return seenAt !== undefined && now - seenAt < TIMING.viewMs;
}

/** A time with no recognition result that is longer than this is a stall of the frames. The view is unknown in it. */
export const FRAME_STALL_MS = 1500;

export function newFrameState(): FrameState {
  return { at: null, stall: null };
}

/** The frame state of a session. A session that an older server stored has none, so this fills it. */
function framesOf(s: SessionState): FrameState {
  if ((s as { frames?: FrameState }).frames === undefined) s.frames = newFrameState();
  return s.frames;
}

/** For each recognition result. */
export function noteFrame(s: SessionState, now: number): void {
  const frames = framesOf(s);
  if (frames.at !== null && now - frames.at > FRAME_STALL_MS) frames.stall = { from: frames.at, to: now };
  frames.at = now;
}

/**
 * R4: the view test of a product for a head answer. The time of a stall does not count as time out of view:
 * the phone can send a nod seconds late after a stall, and no frame showed in that time that the product left.
 * Only the last stall that ended counts, and the stall that still runs.
 */
export function inViewForHead(s: SessionState, productId: string, now: number): boolean {
  const seenAt = s.seen[productId];
  if (seenAt === undefined) return false;
  const { at, stall } = (s as { frames?: FrameState }).frames ?? newFrameState();
  let unknownMs = 0;
  if (stall && stall.to > seenAt) unknownMs += stall.to - Math.max(stall.from, seenAt);
  // A sighting from a barcode or a label also shows that a frame arrived.
  const lastFrameAt = Math.max(at ?? seenAt, seenAt);
  if (now - lastFrameAt > FRAME_STALL_MS) unknownMs += now - lastFrameAt;
  return now - seenAt - unknownMs < TIMING.viewMs;
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
