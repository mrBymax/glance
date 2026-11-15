import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { type StoreChange, openLiveStore } from './liveStore';
import type { ProductDetails, ProductInfo } from './productInfo';
import { fromEntries } from './storeEntries';
import { readStoreListFile } from './storeList';

const tempDir = mkdtempSync(join(tmpdir(), 'glance-live-store-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));
let fileCount = 0;

const nutella = { gtin: '3017624010701', priceCents: 399, name: 'Nutella' };
const spaghetti = { gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5' };
const details: ProductDetails = { brand: 'Barilla', quantity: '500 g', allergens: ['gluten'], vegan: true, vegetarian: true };
const info = (cached: ProductInfo['cached']): ProductInfo => ({ byGtin: async () => null, cached, holds: async () => true });

async function open(cached: ProductInfo['cached'] = async () => null) {
  fileCount += 1;
  const path = join(tempDir, `list-${fileCount}.json`);
  writeFileSync(path, JSON.stringify([nutella]));
  const list = readStoreListFile(path);
  const lines: string[] = [];
  const live = await openLiveStore(list, info(cached), (line) => lines.push(line));
  const changes: StoreChange[] = [];
  live.onChange((change) => changes.push(change));
  return { live, list, path, changes, lines };
}

it('holds the entries of the start', async () => {
  const { live } = await open();
  expect(live.current()).toEqual([{ item: nutella, details: null }]);
  expect(live.current()).toBe(live.current());
});
it('put stores a new item at the end with the details of the cache, and tells the listener after the list changed', async () => {
  const { live, list, path } = await open(async (gtin) => (gtin === spaghetti.gtin ? details : null));
  const before = live.current();
  let seenInListener: unknown;
  live.onChange(() => { seenInListener = live.current(); });
  expect(await live.put(spaghetti)).toEqual({ item: spaghetti, details });
  expect(live.current()).toEqual([{ item: nutella, details: null }, { item: spaghetti, details }]);
  expect(live.current()).not.toBe(before);
  expect(seenInListener).toBe(live.current());
  expect(await list.byGtin(spaghetti.gtin)).toEqual(spaghetti);
  expect(await readStoreListFile(path).all()).toEqual([nutella, spaghetti]);
});
it('put replaces an item in its place', async () => {
  const { live, changes } = await open();
  await live.put(spaghetti);
  const cheaper = { ...nutella, priceCents: 349 };
  await live.put(cheaper);
  expect(live.current().map((entry) => entry.item)).toEqual([cheaper, spaghetti]);
  expect(changes).toEqual([{ kind: 'put', entry: { item: spaghetti, details: null } }, { kind: 'put', entry: { item: cheaper, details: null } }]);
});
it('a cache that fails costs the details, not the item', async () => {
  const { live, lines } = await open(async () => { throw new Error('disk gone'); });
  expect(await live.put(spaghetti)).toEqual({ item: spaghetti, details: null });
  expect(lines.at(-1)).toMatch(/gtin=8076800195057 disk gone/);
});
it('remove takes the item out and tells the listener, and a code that the list does not hold tells no one', async () => {
  const { live, changes, path } = await open();
  expect(await live.remove(spaghetti.gtin)).toBe(false);
  expect(changes).toEqual([]);
  expect(await live.remove(nutella.gtin)).toBe(true);
  expect(live.current()).toEqual([]);
  expect(changes).toEqual([{ kind: 'remove', gtin: nutella.gtin }]);
  expect(await readStoreListFile(path).all()).toEqual([]);
});
it('a store list that does not write rejects, and the entries stay', async () => {
  const { live, list, changes } = await open();
  list.put = async () => { throw new Error('read only'); };
  await expect(live.put(spaghetti)).rejects.toThrow('read only');
  expect(live.current()).toHaveLength(1);
  expect(changes).toEqual([]);
});

it('fromEntries builds again only for another list', async () => {
  const { live } = await open();
  let builds = 0;
  const names = fromEntries(live.current, (entries) => {
    builds += 1;
    return entries.map((entry) => entry.item.name);
  });
  expect(names()).toEqual(['Nutella']);
  expect(names()).toBe(names());
  expect(builds).toBe(1);
  await live.put(spaghetti);
  expect(names()).toEqual(['Nutella', 'Spaghetti n.5']);
  expect(builds).toBe(2);

  const fixed = fromEntries([{ item: nutella, details: null }], (entries) => entries.length);
  expect(fixed()).toBe(1);
});
