// A test helper. No product code imports this file.
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, EMPTY_CART } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { createSessionState } from '../sessions/step';
import type { KioskRecord, OrderRecord, SessionRecord, Store } from './store';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const oat = catalog.get('oat-drink-1l')!;
const rye = catalog.get('rye-bread')!;

function sessionRecord(id: string): SessionRecord {
  return { ...createSessionState({ ...DEFAULT_PROFILE }, 0), _id: id, token: 't1', kioskId: null, updatedAt: 1 };
}

function order(id: string, sessionId: string): OrderRecord {
  return {
    _id: id, sessionId, kioskId: 'k1', totalCents: 189, paidAt: '2026-11-14T10:00:00.000Z', method: 'demo',
    items: [{ productId: oat.id, name: 'Oat drink', packSize: '1 L', qty: 1, unitPriceCents: 189 }],
  };
}

function kiosk(id: string, code: string): KioskRecord {
  return {
    _id: id, token: 'kt', code, name: 'Checkout 3', store: 'Demo Market',
    boundSessionId: null, lastSeenAt: null, spotCheck: false, failPayment: false,
  };
}

/** Registers one describe block with the tests that each store must pass. Each test opens a new store. */
export function storeContract(name: string, open: () => Promise<Store>): void {
  describe(name, () => {
    let store: Store;
    beforeEach(async () => {
      store = await open();
    });
    afterEach(() => store.close());

    it('replaces the products and lists them sorted by ID', async () => {
      await store.replaceProducts([rye, oat]);
      expect((await store.listProducts()).map((p) => p.id)).toEqual(['oat-drink-1l', 'rye-bread']);
      await store.replaceProducts([oat]);
      expect(await store.listProducts()).toEqual([oat]);
    });
    it('keeps a session and returns a copy', async () => {
      const record = sessionRecord('s1');
      await store.putSession(record);
      record.cart = { items: [], totalCents: 999 };
      expect((await store.getSession('s1'))!.cart).toEqual(EMPTY_CART);
      expect(await store.getSession('nope')).toBeNull();
    });
    it('gives back each field of a session', async () => {
      const record: SessionRecord = {
        ...sessionRecord('s1'),
        seen: { 'oat-drink-1l': 5 },
        prompt: { id: 'p-0001', kind: 'product', mode: 'new', productId: 'oat-drink-1l', startedAt: 3, doneAt: null },
        kioskId: 'k1',
      };
      await store.putSession(record);
      expect(await store.getSession('s1')).toEqual(record);
    });
    it('replaces a session that it already holds', async () => {
      await store.putSession(sessionRecord('s1'));
      await store.putSession({ ...sessionRecord('s1'), updatedAt: 2 });
      expect((await store.getSession('s1'))!.updatedAt).toBe(2);
    });
    it('deletes a session with its orders and keeps the orders of other sessions', async () => {
      await store.putSession(sessionRecord('s1'));
      await store.insertOrder(order('ord-1', 's1'));
      await store.insertOrder(order('ord-2', 's2'));
      await store.deleteSession('s1');
      expect(await store.getSession('s1')).toBeNull();
      expect(await store.listOrders('s1')).toEqual([]);
      expect((await store.listOrders('s2')).map((o) => o._id)).toEqual(['ord-2']);
    });
    it('keeps a kiosk and rejects a second kiosk with the same code', async () => {
      await store.putKiosk(kiosk('k1', 'K3X7'));
      await store.putKiosk({ ...kiosk('k1', 'K3X7'), boundSessionId: 's1' });
      expect((await store.listKiosks())[0]!.boundSessionId).toBe('s1');
      await expect(store.putKiosk(kiosk('k2', 'K3X7'))).rejects.toThrow();
      expect(await store.listKiosks()).toHaveLength(1);
    });
    it('keeps a clip record', async () => {
      await store.putClip({ _id: 'a'.repeat(64), path: '/data/a.mp3' });
      expect(await store.getClip('a'.repeat(64))).toEqual({ _id: 'a'.repeat(64), path: '/data/a.mp3' });
      expect(await store.getClip('b'.repeat(64))).toBeNull();
    });
  });
}
