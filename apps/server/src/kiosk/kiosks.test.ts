import { expect, it } from 'vitest';
import { KioskEventSchema } from '@glance/shared';
import type { KioskRecord } from '../db/store';
import { CRISPS, OAT, RYE, harness } from '../sessions/harness';
import { kioskView } from './kiosks';

const record: KioskRecord = { _id: 'k1', token: 't', code: 'K3X7', name: 'Checkout 3', store: 'Demo Market',
  boundSessionId: null, lastSeenAt: null, spotCheck: false, failPayment: false };
const kiosk = { id: 'k1', name: 'Checkout 3', store: 'Demo Market' };
const receipt = { orderId: 'ord-1', totalCents: 639, paidAt: '2026-11-14T12:00:00.000Z', items: [], kiosk };

function checkout() {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.send({ type: 'kiosk.seen', kiosk, busy: false, spotCheck: false });
  return h;
}

it('shows idle with the code and no cart', () => {
  expect(kioskView(record, null, null)).toEqual({
    type: 'kiosk.state', state: 'idle', kiosk, code: 'K3X7', cart: null, totalCents: null, receipt: null,
  });
});
it('shows the cart of the session during a checkout', () => {
  const h = checkout();
  expect(kioskView(record, h.state, null)).toMatchObject({ state: 'connected', totalCents: 639, cart: h.state.cart, receipt: null });
});
it('shows idle for a session with no checkout, and for a checkout at another kiosk', () => {
  expect(kioskView(record, harness({ cart: [OAT] }).state, null).state).toBe('idle');
  expect(kioskView({ ...record, _id: 'k2' }, checkout().state, null)).toMatchObject({ state: 'idle', cart: null });
});
it('shows a result before the checkout state', () => {
  expect(kioskView(record, null, { state: 'paid', receipt })).toMatchObject({ state: 'paid', receipt, totalCents: 639, cart: null });
  expect(kioskView(record, null, { state: 'failed' })).toMatchObject({ state: 'failed', receipt: null });
  expect(kioskView(record, checkout().state, { state: 'failed' })).toMatchObject({ state: 'failed', cart: null, totalCents: null });
});
it('each view passes the shared schema', () => {
  const views = [
    kioskView(record, null, null), kioskView(record, checkout().state, null),
    kioskView(record, null, { state: 'paid', receipt }), kioskView(record, null, { state: 'failed' }),
  ];
  for (const view of views) expect(KioskEventSchema.safeParse(view).success).toBe(true);
});
it('shows the spot check with the cart and the total, and the cart alone after it', () => {
  const h = harness({ cart: [RYE, OAT, CRISPS] });
  h.send({ type: 'kiosk.seen', kiosk, busy: false, spotCheck: true });
  const view = kioskView(record, h.state, null);
  expect(view).toMatchObject({ state: 'spotcheck', totalCents: 639, cart: h.state.cart, receipt: null });
  expect(KioskEventSchema.safeParse(view).success).toBe(true);
  h.see(RYE);
  expect(kioskView(record, h.state, null).state).toBe('connected');
});
