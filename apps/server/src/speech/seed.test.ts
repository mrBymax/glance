import { expect, it, vi } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import { makeClips, seedLines } from './seed';

const dev = readCatalogFile('catalog/catalog.dev.json');

it('lists the lines to make in advance, with no duplicate', () => {
  const lines = seedLines(dev);
  expect(lines).toHaveLength(30 + 3 * dev.length);
  expect(new Set(lines).size).toBe(lines.length);
  for (const line of ['Oat drink, one litre, one eighty-nine. Nod to add.', 'Oat drink, one litre, one eighty-nine.',
    'Oat drink. One is in your cart. Nod to add another. Shake to remove.', 'Skipped.',
    'Glasses battery at ten percent.', 'I can see part of it. Turn the front to me.', 'Listening.']) expect(lines).toContain(line);
});
it('lists 30 lines for a catalog with no product', () => {
  expect(seedLines([])).toHaveLength(30);
});
it('makes one clip at a time and counts each clip that failed', async () => {
  let running = 0;
  let most = 0;
  const clipUrl = vi.fn(async (text: string) => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    running -= 1;
    return text === 'b' ? null : `http://localhost/${text}.mp3`;
  });
  expect(await makeClips(['a', 'b', 'c'], clipUrl)).toEqual({ made: 2, failed: 1 });
  expect(clipUrl.mock.calls).toEqual([['a', 'en'], ['b', 'en'], ['c', 'en']]);
  expect(most).toBe(1);
});
