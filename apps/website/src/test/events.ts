import { parseServerEvent, SessionSnapshotSchema, type ServerEvent, type SessionSnapshot } from '@glance/shared';
import snapshotMessage from '@glance/shared/fixtures/bridge-native-to-page/snapshot.json';
import caption from '@glance/shared/fixtures/events/caption.json';
import cartUpdated from '@glance/shared/fixtures/events/cart.updated.json';
import glancePending from '@glance/shared/fixtures/events/glance.pending.json';

const EVENT_JSON = { caption, 'cart.updated': cartUpdated, 'glance.pending': glancePending };

/** Returns the event of `events/<type>.json` of the shared fixtures. */
export function event<K extends keyof typeof EVENT_JSON>(type: K): Extract<ServerEvent, { type: K }> {
  const parsed = parseServerEvent(EVENT_JSON[type]);
  if (parsed?.type !== type) throw new Error(`fixture events/${type}.json is not a ${type} event`);
  return parsed as Extract<ServerEvent, { type: K }>;
}

export const SNAPSHOT: SessionSnapshot = SessionSnapshotSchema.parse(snapshotMessage.session);
