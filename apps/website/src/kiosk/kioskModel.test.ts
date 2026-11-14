import created from '@glance/shared/fixtures/rest/CreateKioskResponse.json';
import fixture from '@glance/shared/fixtures/rest/KioskEvent.json';
import { expect, it } from 'vitest';
import { idleEvent, KIOSK_MAX_ROWS, kioskFlags, kioskRows, parseKioskEvent } from './kioskModel';

it('reads the flags of the address', () => {
  expect(kioskFlags('?name=Checkout%205&store=Corner%20Shop&spot=1&fail=1'))
    .toEqual({ name: 'Checkout 5', store: 'Corner Shop', spotCheck: true, failPayment: true });
});
it('uses the demo names when a flag is missing or empty', () => {
  expect(kioskFlags('')).toEqual({ name: 'Checkout 3', store: 'Demo Market', spotCheck: false, failPayment: false });
  expect(kioskFlags('?name=%20%20&spot=0&fail=false')).toEqual({ name: 'Checkout 3', store: 'Demo Market', spotCheck: false, failPayment: false });
});
it('cuts a name of 200 characters to 40', () => {
  expect(kioskFlags(`?name=${'A'.repeat(200)}`).name).toHaveLength(40);
});
it('accepts the fixture, and drops a kiosk event that is not valid', () => {
  expect(parseKioskEvent(fixture)?.type).toBe('kiosk.state');
  expect(parseKioskEvent({ ...fixture, code: 'k!' })).toBeNull();
  expect(parseKioskEvent({ type: 'kiosk.exploded' })).toBeNull();
  expect(parseKioskEvent('x')).toBeNull();
});
it('shows at most 7 cart lines and counts the rest', () => {
  const item = (n: number) => ({ productId: `p-${n}`, name: `Product ${n}`, packSize: '1 L', qty: 1, unitPriceCents: 100 });
  const cart = { items: Array.from({ length: 9 }, (_, n) => item(n)), totalCents: 900 };
  expect(KIOSK_MAX_ROWS).toBe(7);
  expect(kioskRows(cart).rows).toHaveLength(7);
  expect(kioskRows(cart).hiddenCount).toBe(2);
  expect(kioskRows(null)).toEqual({ rows: [], hiddenCount: 0 });
});
it('makes the idle view of a new kiosk, which the schema accepts', () => {
  const event = idleEvent({ name: 'Checkout 5', store: 'Corner Shop' }, created);
  expect(event).toEqual({
    type: 'kiosk.state', state: 'idle', kiosk: { id: created.kioskId, name: 'Checkout 5', store: 'Corner Shop' },
    code: created.code, cart: null, totalCents: null, receipt: null,
  });
  expect(parseKioskEvent(event)).toEqual(event);
});
