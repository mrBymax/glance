import {
  parseNativeToPage, parseServerEvent, type NativeToPage, type ServerEvent, type SessionSnapshot,
} from '@glance/shared';
import snapshotMessage from '@glance/shared/fixtures/bridge-native-to-page/snapshot.json';
import budgetExceeded from '@glance/shared/fixtures/events/budget.exceeded.json';
import caption from '@glance/shared/fixtures/events/caption.json';
import cartUpdated from '@glance/shared/fixtures/events/cart.updated.json';
import checkoutCancelled from '@glance/shared/fixtures/events/checkout.cancelled.json';
import checkoutFailed from '@glance/shared/fixtures/events/checkout.failed.json';
import checkoutOffered from '@glance/shared/fixtures/events/checkout.offered.json';
import checkoutPaid from '@glance/shared/fixtures/events/checkout.paid.json';
import checkoutSpotcheck from '@glance/shared/fixtures/events/checkout.spotcheck.json';
import checkoutSuspended from '@glance/shared/fixtures/events/checkout.suspended.json';
import error from '@glance/shared/fixtures/events/error.json';
import glanceAmbiguous from '@glance/shared/fixtures/events/glance.ambiguous.json';
import glanceCleared from '@glance/shared/fixtures/events/glance.cleared.json';
import glanceHint from '@glance/shared/fixtures/events/glance.hint.json';
import glancePending from '@glance/shared/fixtures/events/glance.pending.json';
import glanceUnknown from '@glance/shared/fixtures/events/glance.unknown.json';
import sessionState from '@glance/shared/fixtures/events/session.state.json';

type EventType = ServerEvent['type'];

// The Record type makes the compiler reject this file when the shared package gets an event type with no entry here.
const EVENT_JSON: Record<EventType, unknown> = {
  'session.state': sessionState,
  'glance.pending': glancePending,
  'glance.cleared': glanceCleared,
  'glance.hint': glanceHint,
  'glance.unknown': glanceUnknown,
  'glance.ambiguous': glanceAmbiguous,
  'cart.updated': cartUpdated,
  'budget.exceeded': budgetExceeded,
  'checkout.offered': checkoutOffered,
  'checkout.suspended': checkoutSuspended,
  'checkout.spotcheck': checkoutSpotcheck,
  'checkout.cancelled': checkoutCancelled,
  'checkout.paid': checkoutPaid,
  'checkout.failed': checkoutFailed,
  caption,
  error,
};

export const EVENT_TYPES = Object.keys(EVENT_JSON) as EventType[];

function parseEventFixture(type: EventType): ServerEvent {
  const event = parseServerEvent(EVENT_JSON[type]);
  if (event?.type !== type) throw new Error(`fixture events/${type}.json is not a ${type} event`);
  return event;
}

const EVENTS = new Map(EVENT_TYPES.map((type) => [type, parseEventFixture(type)]));

function parseSnapshotFixture(): SessionSnapshot {
  const message = parseNativeToPage(snapshotMessage);
  if (message?.t !== 'snapshot') throw new Error('fixture bridge-native-to-page/snapshot.json is not a snapshot message');
  return message.session;
}

export const SNAPSHOT: SessionSnapshot = parseSnapshotFixture();

export function eventFixture<K extends EventType>(type: K): Extract<ServerEvent, { type: K }> {
  // parseEventFixture checked at load time that the event under each key has that type.
  return EVENTS.get(type) as Extract<ServerEvent, { type: K }>;
}

export function eventMessage<K extends EventType>(type: K, change?: Partial<Extract<ServerEvent, { type: K }>>): NativeToPage {
  return { t: 'event', event: { ...eventFixture(type), ...change } as ServerEvent };
}
