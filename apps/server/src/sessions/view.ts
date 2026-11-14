import { TIMING } from '@glance/shared';
import type { SessionState } from './types';

/** A target is in view when its last report is newer than the view time (spec section 6.2, terms). */
export function inView(seenAt: number | undefined, now: number): boolean {
  return seenAt !== undefined && now - seenAt < TIMING.viewMs;
}

/** R9: the products that the next recognition call must not name. */
export function excludeList(state: SessionState, now: number): string[] {
  return state.excluded.filter((entry) => entry.until > now).map((entry) => entry.productId);
}
