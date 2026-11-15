import type { NativeToPage, SessionSnapshot } from '@glance/shared';
import { eventFixture, eventMessage, SNAPSHOT } from './fixtures';

/** `afterMs` counts from the start of the run. */
export type Recording = { afterMs: number; message: NativeToPage }[];

const fullCart = eventFixture('cart.updated').cart;
const items = fullCart.items.filter((item) => item.productId !== 'oat-drink-1l');

const start: SessionSnapshot = {
  ...SNAPSHOT,
  phase: 'shopping',
  prompt: null,
  lastReceipt: null,
  captions: [],
  // The cart fixture without the oat drink. Each line has the quantity 1, so the total is the sum of the unit prices.
  cart: { items, totalCents: items.reduce((total, item) => total + item.unitPriceCents * item.qty, 0) },
};

const caption = (id: string, text: string): NativeToPage =>
  eventMessage('caption', { id, text, lang: 'en', priority: 'normal', url: null });

const at = (afterMs: number, ...messages: NativeToPage[]): Recording => messages.map((message) => ({ afterMs, message }));

/** One shop from the first glance to the payment, for the flag `replay`. */
export const DEMO_RUN: Recording = [
  ...at(0, { t: 'snapshot', session: start }),
  ...at(500, caption('demo-1', 'Camera on. Hold a product up to hear its price.')),
  ...at(2500,
    eventMessage('glance.pending', { kind: 'new' }),
    caption('demo-2', 'Oat drink, one litre, one eighty-nine. Nod to add.')),
  ...at(6000,
    eventMessage('glance.cleared'),
    eventMessage('cart.updated'),
    caption('demo-3', 'Added oat drink. Total four forty-nine.')),
  ...at(9000,
    eventMessage('checkout.offered'),
    caption('demo-4', 'Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay.')),
  ...at(13000,
    eventMessage('checkout.paid'),
    eventMessage('session.state', { phase: 'paid', cameraOn: false }),
    caption('demo-5', 'Paid. Four euros forty-nine. Your receipt is on your phone. Camera off.')),
];

/** Delivers each message at its time. Returns the function that stops the run. */
export function playRecording(recording: Recording, deliver: (message: NativeToPage) => void): () => void {
  const timers = recording.map((entry) => setTimeout(() => deliver(entry.message), entry.afterMs));
  return () => { for (const timer of timers) clearTimeout(timer); };
}
