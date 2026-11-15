import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { StoreEntry } from './storeEntries';
import { WARM_UP_EVERY_MS, startWarmUp } from './warmup';

const entry = (gtin: string): StoreEntry => ({ item: { gtin, priceCents: 100, name: `Item ${gtin}` }, details: null });
const A = '3017624010701', B = '8076800195057', C = '8076809513753';

let held: Set<string>;
let reads: string[];
let logLines: string[];
/** The codes whose read fails: the resolver then gives a product with no details, and the cache holds nothing. */
let failing: Set<string>;

const start = (gtins: string[]) => startWarmUp({
  entries: gtins.map(entry),
  info: { holds: async (gtin) => held.has(gtin) },
  resolver: {
    resolve: async (gtin) => {
      reads.push(gtin);
      if (!failing.has(gtin)) held.add(gtin);
      return null;
    },
  },
  log: (line) => { logLines.push(line); },
});

beforeEach(() => {
  vi.useFakeTimers();
  held = new Set();
  reads = [];
  logLines = [];
  failing = new Set();
});
afterEach(() => {
  vi.useRealTimers();
});

it('reads each item that the cache does not hold, one read each 5 seconds', async () => {
  held.add(B);
  const warmUp = start([A, B, C]);
  await vi.advanceTimersByTimeAsync(0);
  expect(reads).toEqual([A]);
  await vi.advanceTimersByTimeAsync(WARM_UP_EVERY_MS - 1);
  expect(reads).toEqual([A]);
  await vi.advanceTimersByTimeAsync(1);
  expect(reads).toEqual([A, C]);
  await warmUp.done;
  expect(WARM_UP_EVERY_MS).toBe(5000);
});
it('logs its start and its end', async () => {
  held.add(B);
  failing.add(C);
  const warmUp = start([A, B, C]);
  await vi.advanceTimersByTimeAsync(WARM_UP_EVERY_MS);
  await warmUp.done;
  expect(logLines).toEqual([
    'product info: warm-up started. 2 of 3 store items are not in the cache, one read each 5 s',
    'product info: warm-up ended. read=1 failed=1 ms=5000',
  ]);
});
it('makes no read when the cache holds each item', async () => {
  held = new Set([A, B]);
  const warmUp = start([A, B]);
  await warmUp.done;
  expect(reads).toEqual([]);
  expect(logLines).toEqual([
    'product info: warm-up started. 0 of 2 store items are not in the cache, one read each 5 s',
    'product info: warm-up ended. read=0 failed=0 ms=0',
  ]);
});
it('goes on after a read that rejects', async () => {
  const warmUp = startWarmUp({
    entries: [A, B].map(entry),
    info: { holds: async (gtin) => held.has(gtin) },
    resolver: {
      resolve: async (gtin) => {
        reads.push(gtin);
        if (gtin === A) throw new Error('The store list did not answer in 2500 ms.');
        held.add(gtin);
        return null;
      },
    },
    log: (line) => { logLines.push(line); },
  });
  await vi.advanceTimersByTimeAsync(WARM_UP_EVERY_MS);
  await warmUp.done;
  expect(reads).toEqual([A, B]);
  expect(logLines.at(-1)).toBe('product info: warm-up ended. read=1 failed=1 ms=5000');
});
it('stop ends the reads, and no end line follows', async () => {
  const warmUp = start([A, B, C]);
  await vi.advanceTimersByTimeAsync(0);
  warmUp.stop();
  await vi.advanceTimersByTimeAsync(3 * WARM_UP_EVERY_MS);
  await warmUp.done;
  expect(reads).toEqual([A]);
  expect(logLines).toHaveLength(1);
});
