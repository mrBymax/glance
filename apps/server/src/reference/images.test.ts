import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  MAX_REFERENCES, MAX_REFERENCE_BYTES, REFERENCES_FOR_ITEM, type ReferenceImage, createFolderReferences, selectReferences,
} from './images';

const NUTELLA = '3017624010701';
const SPAGHETTI = '8076800195057';
const jpeg = (fill: number, bytes = 4) => new Uint8Array(bytes).fill(fill);

let dir: string;
let now: number;
const store = () => createFolderReferences(dir, { now: () => now });

beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'glance-reference-')), 'reference');
  now = 1_763_000_000_000;
});
afterEach(() => rmSync(join(dir, '..'), { recursive: true, force: true }));

it('has no picture when the folder does not exist', async () => {
  expect(await store().list(NUTELLA)).toEqual([]);
  expect(await store().all()).toEqual(new Map());
});
it('writes a picture to the folder of its item, and lists the newest picture first', async () => {
  const references = store();
  const first = await references.add(NUTELLA, jpeg(1));
  now += 1000;
  const second = await references.add(NUTELLA, jpeg(2, 6));
  expect(first).toEqual({ gtin: NUTELLA, file: '1763000000000.jpg', bytes: 4, addedAt: 1_763_000_000_000 });
  expect(readdirSync(join(dir, NUTELLA)).sort()).toEqual(['1763000000000.jpg', '1763000001000.jpg']);
  expect(await references.list(NUTELLA)).toEqual([second, first]);
  expect([...await references.read(second)]).toEqual([...jpeg(2, 6)]);
  expect(await references.list(SPAGHETTI)).toEqual([]);
});
it('gives two pictures of one millisecond two file names', async () => {
  const references = store();
  await references.add(NUTELLA, jpeg(1));
  expect((await references.add(NUTELLA, jpeg(2))).file).toBe('1763000000001.jpg');
});
it('gives each item with its pictures', async () => {
  const references = store();
  await references.add(NUTELLA, jpeg(1));
  await references.add(SPAGHETTI, jpeg(2));
  const all = await references.all();
  expect([...all.keys()].sort()).toEqual([NUTELLA, SPAGHETTI]);
  expect(all.get(SPAGHETTI)).toHaveLength(1);
});
it('reads a JPEG that a person copied into the folder, with the time of the file', async () => {
  mkdirSync(join(dir, NUTELLA), { recursive: true });
  writeFileSync(join(dir, NUTELLA, 'front.jpeg'), jpeg(7));
  utimesSync(join(dir, NUTELLA, 'front.jpeg'), new Date(5000), new Date(5000));
  expect(await store().list(NUTELLA)).toEqual([{ gtin: NUTELLA, file: 'front.jpeg', bytes: 4, addedAt: 5000 }]);
});
it('ignores a file that is no JPEG and a folder that is no code of 13 digits', async () => {
  mkdirSync(join(dir, NUTELLA), { recursive: true });
  mkdirSync(join(dir, 'notes'), { recursive: true });
  writeFileSync(join(dir, NUTELLA, 'readme.txt'), 'text');
  writeFileSync(join(dir, 'notes', 'a.jpg'), jpeg(1));
  writeFileSync(join(dir, 'stray.jpg'), jpeg(1));
  expect(await store().all()).toEqual(new Map());
});
it('rejects a code that is no 13 digits, so no path outside the folder is written', async () => {
  await expect(store().add('../3017624010701', jpeg(1))).rejects.toThrow(/13 digits/);
  await expect(store().list('..')).rejects.toThrow(/13 digits/);
  await expect(store().remove('301762401070')).rejects.toThrow(/13 digits/);
});
it('removes the pictures of one item and returns their count', async () => {
  const references = store();
  await references.add(NUTELLA, jpeg(1));
  now += 1;
  await references.add(NUTELLA, jpeg(2));
  await references.add(SPAGHETTI, jpeg(3));
  expect(await references.remove(NUTELLA)).toBe(2);
  expect(await references.remove(NUTELLA)).toBe(0);
  expect([...(await references.all()).keys()]).toEqual([SPAGHETTI]);
});
it('removes one picture by its name, and nothing for a name that the item does not have', async () => {
  const references = store();
  const older = await references.add(NUTELLA, jpeg(1));
  now += 1;
  const newer = await references.add(NUTELLA, jpeg(2));
  await references.add(SPAGHETTI, jpeg(3));
  for (const name of ['none.jpg', `../${SPAGHETTI}/${now}.jpg`, `..\\${SPAGHETTI}\\${now}.jpg`, '']) {
    expect(await references.removeOne(NUTELLA, name)).toBe(false);
  }
  expect(await references.removeOne(NUTELLA, newer.file)).toBe(true);
  expect(await references.removeOne(NUTELLA, newer.file)).toBe(false);
  expect((await references.list(NUTELLA)).map((picture) => picture.file)).toEqual([older.file]);
  expect(await references.list(SPAGHETTI)).toHaveLength(1);
  await expect(references.removeOne('..', older.file)).rejects.toThrow(/13 digits/);
});

const image = (gtin: string, addedAt: number, bytes = 100): ReferenceImage => ({ gtin, file: `${addedAt}.jpg`, bytes, addedAt });
const byItem = (...items: [string, ReferenceImage[]][]) => new Map(items);

it('uses the newest 3 pictures of each item in a label call', () => {
  expect(REFERENCES_FOR_ITEM).toBe(3);
  const pictures = [5, 4, 3, 2, 1].map((at) => image(NUTELLA, at));
  expect(selectReferences(byItem([NUTELLA, pictures]), [NUTELLA]).map((picture) => picture.addedAt)).toEqual([5, 4, 3]);
});
it('uses no picture of an item that the store list does not hold, and keeps the order of the store list', () => {
  const all = byItem([NUTELLA, [image(NUTELLA, 1)]], [SPAGHETTI, [image(SPAGHETTI, 2)]], ['4006381333931', [image('4006381333931', 3)]]);
  expect(selectReferences(all, [SPAGHETTI, NUTELLA]).map((picture) => picture.gtin)).toEqual([SPAGHETTI, NUTELLA]);
});
it('sends at most 24 pictures in one call, and each item gets its newest picture before an item gets a second one', () => {
  expect(MAX_REFERENCES).toBe(24);
  const gtins = Array.from({ length: 10 }, (_unused, index) => `20000000000${String(index).padStart(2, '0')}`);
  const all = byItem(...gtins.map((gtin): [string, ReferenceImage[]] => [gtin, [3, 2, 1].map((at) => image(gtin, at))]));
  const selected = selectReferences(all, gtins);
  expect(selected).toHaveLength(24);
  const counts = gtins.map((gtin) => selected.filter((picture) => picture.gtin === gtin).length);
  expect(counts).toEqual([3, 3, 3, 3, 2, 2, 2, 2, 2, 2]);
  // The pictures of one item are together, newest first.
  expect(selected.slice(0, 4).map((picture) => [picture.gtin, picture.addedAt])).toEqual([
    [gtins[0], 3], [gtins[0], 2], [gtins[0], 1], [gtins[1], 3],
  ]);
});
it('sends at most 9 MB of pictures in one call, and leaves out a picture that does not fit', () => {
  expect(MAX_REFERENCE_BYTES).toBe(9_000_000);
  const all = byItem(
    [NUTELLA, [image(NUTELLA, 2, 5_000_000), image(NUTELLA, 1, 1_000_000)]],
    [SPAGHETTI, [image(SPAGHETTI, 2, 5_000_000), image(SPAGHETTI, 1, 3_000_000)]],
  );
  expect(selectReferences(all, [NUTELLA, SPAGHETTI]).map((picture) => [picture.gtin, picture.addedAt])).toEqual([
    [NUTELLA, 2], [NUTELLA, 1], [SPAGHETTI, 1],
  ]);
});
