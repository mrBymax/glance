import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import { scannedProduct } from '../products/scanned';
import { CLIP_WARM_UP_EVERY_MS, createClipWarmUp } from './prewarm';
import { promptLines, seedLines } from './seed';

const kili = scannedProduct({ gtin: '6430062761795', priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' }, null);
const hell = scannedProduct({ gtin: '5999571058020', priceCents: 149, name: 'Hell Classic Zero Sugarfree', brand: 'Hell', packSize: '250 ml' }, null);

let cached: Set<string>;
let asked: string[];
let fail: string | null;
let lines: string[];
const warmUp = () => createClipWarmUp({
  clipUrl: async (text) => {
    asked.push(text);
    if (text === fail) return null;
    cached.add(text);
    return `http://clips/${asked.length}`;
  },
  hasClip: (text) => cached.has(text),
  log: (line) => lines.push(line),
});

beforeEach(() => {
  vi.useFakeTimers();
  cached = new Set();
  asked = [];
  fail = null;
  lines = [];
});
afterEach(() => vi.useRealTimers());

it('the prompt lines of a product are its new line with and with no hint, and its line in the cart', () => {
  expect(promptLines([kili])).toEqual([
    'Kili Cascara Yuzu plus Sitruuna, two forty-nine. Nod to add.',
    'Kili Cascara Yuzu plus Sitruuna, two forty-nine.',
    'Kili Cascara Yuzu plus Sitruuna. One is in your cart. Nod to add another. Shake to remove.',
  ]);
  expect(promptLines([kili], 'it')[1]).toBe('Kili Cascara Yuzu più Sitruuna, due e quarantanove.');
});
it('the seed still holds the prompt lines of each product', () => {
  const dev = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
  for (const text of promptLines(dev)) expect(seedLines(dev)).toContain(text);
});
it('makes the clips of the prompt lines one at a time, with a pause between two calls', async () => {
  const warm = warmUp();
  warm.add([kili, hell]);
  await vi.advanceTimersByTimeAsync(0);
  expect(asked).toEqual([promptLines([kili])[0]]);
  await vi.advanceTimersByTimeAsync(CLIP_WARM_UP_EVERY_MS - 1);
  expect(asked).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(asked).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(5 * CLIP_WARM_UP_EVERY_MS);
  expect(asked).toEqual(promptLines([kili, hell]));
  await warm.idle();
  expect(lines).toEqual([
    'speech: warm-up started. 6 prompt lines of 2 store items have no clip, one call each 250 ms',
    'speech: warm-up ended. made=6 failed=0',
  ]);
});
it('makes no call and no pause for a line that has its clip', async () => {
  for (const text of promptLines([kili])) cached.add(text);
  cached.add(promptLines([hell])[0]!);
  const warm = warmUp();
  warm.add([kili, hell]);
  await vi.advanceTimersByTimeAsync(CLIP_WARM_UP_EVERY_MS);
  expect(asked).toEqual(promptLines([hell]).slice(1));
  await warm.idle();
  expect(lines[0]).toBe('speech: warm-up started. 2 prompt lines of 2 store items have no clip, one call each 250 ms');
});
it('writes no line when each clip exists', async () => {
  for (const text of promptLines([kili])) cached.add(text);
  const warm = warmUp();
  warm.add([kili]);
  await warm.idle();
  expect(asked).toEqual([]);
  expect(lines).toEqual([]);
});
it('counts a clip that failed, and goes on', async () => {
  fail = promptLines([kili])[0]!;
  const warm = warmUp();
  warm.add([kili]);
  await vi.advanceTimersByTimeAsync(3 * CLIP_WARM_UP_EVERY_MS);
  await warm.idle();
  expect(lines.at(-1)).toBe('speech: warm-up ended. made=2 failed=1');
});
it('takes products that come later, as the product database gives a new pack size', async () => {
  const warm = warmUp();
  warm.add([kili]);
  await vi.advanceTimersByTimeAsync(3 * CLIP_WARM_UP_EVERY_MS);
  warm.add([kili, hell]);
  await vi.advanceTimersByTimeAsync(3 * CLIP_WARM_UP_EVERY_MS);
  await warm.idle();
  expect(asked).toEqual(promptLines([kili, hell]));
});
it('stop ends the calls', async () => {
  const warm = warmUp();
  warm.add([kili, hell]);
  await vi.advanceTimersByTimeAsync(0);
  warm.stop();
  await vi.advanceTimersByTimeAsync(10 * CLIP_WARM_UP_EVERY_MS);
  await warm.idle();
  expect(asked).toHaveLength(1);
});
