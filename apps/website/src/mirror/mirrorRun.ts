import { parseServerEvent, type ServerEvent } from '@glance/shared';
import captionJson from '@glance/shared/fixtures/events/caption.json';
import cartUpdated from '@glance/shared/fixtures/events/cart.updated.json';
import checkoutOffered from '@glance/shared/fixtures/events/checkout.offered.json';
import checkoutPaid from '@glance/shared/fixtures/events/checkout.paid.json';
import glanceCleared from '@glance/shared/fixtures/events/glance.cleared.json';
import glancePending from '@glance/shared/fixtures/events/glance.pending.json';
import type { Timed } from '../lib/events';

function fixtureEvent(json: unknown, name: string): ServerEvent {
  const event = parseServerEvent(json);
  if (!event) throw new Error(`fixture events/${name}.json is not a server event`);
  return event;
}

const captionFixture = fixtureEvent(captionJson, 'caption');

// The run has no clip, so the replay plays no sound.
const caption = (id: string, text: string): ServerEvent => ({ ...captionFixture, id, text, url: null }) as ServerEvent;

const at = (afterMs: number, ...events: ServerEvent[]): Timed<ServerEvent>[] => events.map((event) => ({ afterMs, event }));

/**
 * One shop from the first glance to the payment, for the flag `replay`.
 * It holds the events of the demo run of the phone UI. The website cannot import the phone UI, so this file builds them again.
 */
export const MIRROR_RUN: Timed<ServerEvent>[] = [
  ...at(500, caption('demo-1', 'Camera on. Hold a product up to hear its price.')),
  ...at(2500,
    fixtureEvent(glancePending, 'glance.pending'),
    caption('demo-2', 'Oat drink, one litre, one eighty-nine. Nod to add.')),
  ...at(6000,
    fixtureEvent(glanceCleared, 'glance.cleared'),
    fixtureEvent(cartUpdated, 'cart.updated'),
    caption('demo-3', 'Added oat drink. Total four forty-nine.')),
  ...at(9000,
    fixtureEvent(checkoutOffered, 'checkout.offered'),
    caption('demo-4', 'Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay.')),
  ...at(13000,
    fixtureEvent(checkoutPaid, 'checkout.paid'),
    { type: 'session.state', phase: 'paid', cameraOn: false },
    caption('demo-5', 'Paid. Four euros forty-nine. Your receipt is on your phone. Camera off.')),
];
