import type { CartItem, Product } from '@glance/shared';
import type { SessionState } from '../sessions/types';

/** The session state with its ID, its token, the kiosk of an open checkout, and the time of the write. */
export type SessionRecord = SessionState & { _id: string; token: string; kioskId: string | null; updatedAt: number };

export type KioskRecord = {
  _id: string; token: string; code: string; name: string; store: string;
  boundSessionId: string | null; lastSeenAt: number | null; spotCheck: boolean; failPayment: boolean;
};

export type OrderRecord = {
  _id: string; sessionId: string; kioskId: string; items: CartItem[]; totalCents: number; paidAt: string; method: 'demo';
};

/** `_id` is the clip hash. */
export type ClipRecord = { _id: string; path: string };

/**
 * The data that outlives a request: the collections of spec section 8.6.
 * A record that a caller gets or gives is a copy. A later change to it does not reach the store.
 */
export interface Store {
  /** Sorted by ID. */
  listProducts(): Promise<Product[]>;
  replaceProducts(products: Product[]): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  putSession(record: SessionRecord): Promise<void>;
  /** Also deletes the orders of the session. */
  deleteSession(id: string): Promise<void>;
  listKiosks(): Promise<KioskRecord[]>;
  /** Throws if another kiosk has the same code. */
  putKiosk(record: KioskRecord): Promise<void>;
  insertOrder(order: OrderRecord): Promise<void>;
  listOrders(sessionId: string): Promise<OrderRecord[]>;
  getClip(hash: string): Promise<ClipRecord | null>;
  putClip(clip: ClipRecord): Promise<void>;
  close(): Promise<void>;
}
