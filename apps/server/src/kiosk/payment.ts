import { randomBytes } from 'node:crypto';
import type { KioskRef } from '@glance/shared';
import type { Clock } from '../clock';
import type { OrderRecord, Store } from '../db/store';
import type { SessionRuntime } from '../sessions/runtime';
import type { KioskService } from './kiosks';

const ORDER_ID_BYTES = 4;

/**
 * The mock payment of spec section 11.4. No money moves.
 * The returned function is RuntimeDeps.startPayment: after `delayMs` it gives the session a `payment.result` input.
 * A kiosk with `failPayment` declines. Each other kiosk gets an order in the store first.
 * `cancelAll` drops the payments that wait, for the close of the app.
 */
export function createPayments(deps: { store: Store; clock: Clock; kiosks: KioskService; delayMs: number }):
((session: SessionRuntime, kiosk: KioskRef, totalCents: number) => void) & { cancelAll(): void } {
  const timers = new Set<NodeJS.Timeout>();
  const declined = { type: 'payment.result', ok: false, orderId: '', paidAt: '' } as const;

  const pay = async (session: SessionRuntime, kiosk: KioskRef, totalCents: number): Promise<void> => {
    if (session.stopped) return;
    const record = deps.kiosks.get(kiosk.id);
    if (!record || record.failPayment) {
      session.dispatch(declined);
      return;
    }
    const order: OrderRecord = {
      _id: `ord-${randomBytes(ORDER_ID_BYTES).toString('hex')}`,
      sessionId: session.id,
      kioskId: kiosk.id,
      // The rules change no cart while a payment runs, so these are the items that the shopper agreed to pay.
      items: session.state.cart.items,
      totalCents,
      paidAt: new Date(deps.clock.now()).toISOString(),
      method: 'demo',
    };
    try {
      await deps.store.insertOrder(order);
    } catch (error) {
      // With no stored order the shopper has no receipt, so the payment counts as failed and the cart stays.
      console.error(`session ${session.id}: the order write failed:`, error);
      session.dispatch(declined);
      return;
    }
    session.dispatch({ type: 'payment.result', ok: true, orderId: order._id, paidAt: order.paidAt });
  };

  const start = (session: SessionRuntime, kiosk: KioskRef, totalCents: number): void => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      pay(session, kiosk, totalCents).catch((error) => {
        console.error(`session ${session.id}: the payment failed:`, error);
      });
    }, deps.delayMs);
    timers.add(timer);
  };

  return Object.assign(start, {
    cancelAll: () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  });
}
