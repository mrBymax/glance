import { KioskEventSchema, parseServerEvent, type KioskEvent } from '@glance/shared';
import cartUpdated from '@glance/shared/fixtures/events/cart.updated.json';
import checkoutPaid from '@glance/shared/fixtures/events/checkout.paid.json';
import kioskEvent from '@glance/shared/fixtures/rest/KioskEvent.json';
import type { Timed } from '../lib/events';

function fixtureEvent<K extends 'cart.updated' | 'checkout.paid'>(json: unknown, type: K) {
  const event = parseServerEvent(json);
  if (event?.type !== type) throw new Error(`fixture events/${type}.json is not a ${type} event`);
  return event as Extract<typeof event, { type: K }>;
}

const base = KioskEventSchema.parse(kioskEvent);
const { cart } = fixtureEvent(cartUpdated, 'cart.updated');
const { type, ...receipt } = fixtureEvent(checkoutPaid, 'checkout.paid');

const idle: KioskEvent = { ...base, state: 'idle', cart: null, totalCents: null, receipt: null };
const connected: KioskEvent = { ...idle, state: 'connected', cart, totalCents: cart.totalCents };
const paid: KioskEvent = { ...idle, state: 'paid', totalCents: receipt.totalCents, receipt };
const failed: KioskEvent = { ...idle, state: 'failed' };

/** Two checkouts for the flag `replay`: one payment, and one payment that fails. */
export const KIOSK_RUN: Timed<KioskEvent>[] = [
  { afterMs: 0, event: idle },
  { afterMs: 3000, event: connected },
  { afterMs: 8000, event: paid },
  { afterMs: 13000, event: idle },
  { afterMs: 16000, event: connected },
  { afterMs: 20000, event: failed },
  { afterMs: 24000, event: idle },
];

/** A spot check starts this long after the glasses read the code. */
export const SPOT_AFTER_MS = 2000;
/** A spot check stays on the screen for this time. */
export const SPOT_MS = 4000;

function withSpotChecks(run: Timed<KioskEvent>[]): Timed<KioskEvent>[] {
  let shiftMs = 0;
  return run.flatMap((entry) => {
    const at = entry.afterMs + shiftMs;
    if (entry.event.state !== 'connected') return [{ ...entry, afterMs: at }];
    shiftMs += SPOT_AFTER_MS + SPOT_MS;
    return [
      { afterMs: at, event: entry.event },
      { afterMs: at + SPOT_AFTER_MS, event: { ...entry.event, state: 'spotcheck' } },
      { afterMs: at + SPOT_AFTER_MS + SPOT_MS, event: entry.event },
    ];
  });
}

/** KIOSK_RUN with one spot check after each `connected` event, for the flags `replay` and `spot`. Each later event moves by 6 seconds. */
export const KIOSK_SPOT_RUN: Timed<KioskEvent>[] = withSpotChecks(KIOSK_RUN);
