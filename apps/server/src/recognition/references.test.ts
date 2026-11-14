import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import type { StoreEntry } from '../products/storeEntries';
import { type ReferenceImages, createFolderReferences } from '../reference/images';
import {
  FRAME_REFERENCES_CHECK_MS, FRAME_REFERENCES_MAX_AGE_MS, MAX_FRAME_REFERENCES, MAX_FRAME_REFERENCE_BYTES, type PicturePart,
  createFrameReferences, createPictureUploader, loadFrameReferences, refreshOnChange, sharePictureParts,
} from './references';

const dev = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const OAT = dev.find((product) => product.gtin !== undefined)!;
const NUTELLA = '3017624010701';
const CUPS = '6438574558384';
const entry = (gtin: string, name: string): StoreEntry => ({ item: { gtin, priceCents: 100, name }, details: null });
const entries = [entry(NUTELLA, 'Nutella'), entry(CUPS, 'Paper cups'), entry(OAT.gtin!, 'Oat drink of the store list')];
const numbered = (count: number): StoreEntry[] => Array.from({ length: count }, (_unused, index) => entry(String(4_000_000_000_000 + index), `Item ${index}`));
const jpeg = (fill: number, bytes = 4) => new Uint8Array(bytes).fill(fill);
const picture = (bytes: Uint8Array) => ({
  inlineData: { mimeType: 'image/jpeg', data: Buffer.from(bytes).toString('base64') },
  mediaResolution: { level: 'MEDIA_RESOLUTION_LOW' },
});

let dir: string;
let now: number;
let store: ReferenceImages;
let lines: string[];

beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), 'glance-frame-reference-')), 'reference');
  now = 1_763_000_000_000;
  store = createFolderReferences(dir, { now: () => now });
  lines = [];
});
afterEach(() => rmSync(join(dir, '..'), { recursive: true, force: true }));

async function add(gtin: string, fill: number, bytes = 4): Promise<void> {
  now += 1000;
  await store.add(gtin, jpeg(fill, bytes));
}

it('gives each item its newest pictures, each after a text part with the product ID, at the low media resolution', async () => {
  await add(CUPS, 1);
  await add(NUTELLA, 2);
  await add(NUTELLA, 3);
  await add(NUTELLA, 4);
  await add(OAT.gtin!, 5);
  const loaded = await loadFrameReferences(store, entries, dev, 2);
  // The order is that of the store list. A store item that the catalog holds has the ID and the name of its catalog product.
  expect(loaded.parts).toEqual([
    { text: 'Reference picture of gtin-3017624010701: Nutella' }, picture(jpeg(4)),
    { text: 'Reference picture of gtin-3017624010701: Nutella' }, picture(jpeg(3)),
    { text: 'Reference picture of gtin-6438574558384: Paper cups' }, picture(jpeg(1)),
    { text: `Reference picture of ${OAT.id}: ${OAT.name.en}` }, picture(jpeg(5)),
  ]);
  expect(loaded).toMatchObject({ items: 3, pictures: 4, leftOut: 0, storedItems: 3, storedPictures: 5 });
});
it('gives no part with 0 pictures for each item, with no picture, and for a code outside the store list', async () => {
  await add('4006381333931', 1);
  expect(await loadFrameReferences(store, entries, dev, 3)).toMatchObject({ parts: [], items: 0, pictures: 0, leftOut: 0, storedItems: 1 });
  await add(NUTELLA, 2);
  expect(await loadFrameReferences(store, entries, dev, 0)).toMatchObject({ parts: [], items: 0, pictures: 0, leftOut: 0, storedPictures: 2 });
});
it('at the picture limit each item gets its newest picture before an item gets a second one', async () => {
  const many = numbered(MAX_FRAME_REFERENCES - 2);
  for (const { item } of many) {
    await add(item.gtin, 1);
    await add(item.gtin, 2);
  }
  const loaded = await loadFrameReferences(store, many, dev, 2);
  expect(loaded).toMatchObject({ items: MAX_FRAME_REFERENCES - 2, pictures: MAX_FRAME_REFERENCES, leftOut: 0 });
  // The first two items of the store list have two pictures, and the pictures of one item stay together.
  expect(loaded.parts.slice(0, 6)).toEqual([
    { text: 'Reference picture of gtin-4000000000000: Item 0' }, picture(jpeg(2)),
    { text: 'Reference picture of gtin-4000000000000: Item 0' }, picture(jpeg(1)),
    { text: 'Reference picture of gtin-4000000000001: Item 1' }, picture(jpeg(2)),
  ]);
  expect(loaded.parts.slice(-2)).toEqual([{ text: `Reference picture of gtin-${many.at(-1)!.item.gtin}: Item ${many.length - 1}` }, picture(jpeg(2))]);
});
it('with more items than the picture limit, the first items of the store list get one picture, and the others get none', async () => {
  const many = numbered(MAX_FRAME_REFERENCES + 3);
  for (const { item } of many) await add(item.gtin, 1);
  const loaded = await loadFrameReferences(store, many, dev, 3);
  expect(loaded).toMatchObject({ items: MAX_FRAME_REFERENCES, pictures: MAX_FRAME_REFERENCES, leftOut: 3 });
  expect(loaded.parts.at(-2)).toEqual({ text: `Reference picture of gtin-${many[MAX_FRAME_REFERENCES - 1]!.item.gtin}: Item ${MAX_FRAME_REFERENCES - 1}` });
});
it('the four items of a demo with 13 pictures get three pictures each', async () => {
  const four = numbered(4);
  for (let fill = 1; fill <= 4; fill += 1) await add(four[0]!.item.gtin, fill);
  for (const { item } of four.slice(1)) for (let fill = 1; fill <= 3; fill += 1) await add(item.gtin, fill);
  expect(await loadFrameReferences(store, four, dev, 3)).toMatchObject({ items: 4, pictures: 12, leftOut: 0, storedPictures: 13 });
});
it('stops at the byte limit', async () => {
  await add(NUTELLA, 1, MAX_FRAME_REFERENCE_BYTES - 10);
  await add(CUPS, 2, 11);
  expect(await loadFrameReferences(store, entries, dev, 1)).toMatchObject({ items: 1, pictures: 1, leftOut: 1 });
});

const references = (perItem = 1, over: { store?: ReferenceImages; entries?: StoreEntry[]; picturePart?: PicturePart } = {}) => createFrameReferences({
  store: over.store ?? store, entries: over.entries ?? entries, products: dev, perItem,
  ...(over.picturePart ? { picturePart: over.picturePart } : {}),
  dir: 'catalog/reference', clock: { now: () => now }, log: (line) => lines.push(line),
});

it('logs the pictures at the first read, and holds the parts with no read of the folder for each call', async () => {
  await add(NUTELLA, 1);
  const held = references();
  expect(held.current()).toEqual([]);
  await held.refresh();
  expect(lines).toEqual(['reference pictures: catalog/reference, 1 items, 1 pictures, 1 in a frame call']);
  const parts = held.current();
  expect(parts).toEqual([{ text: 'Reference picture of gtin-3017624010701: Nutella' }, picture(jpeg(1))]);
  // A file that leaves the disk does not change the parts before the next check.
  rmSync(dir, { recursive: true });
  expect(held.current()).toBe(parts);
});
it('logs the pictures again when the folder changes after the start, and not when it stays as it is', async () => {
  const held = references(3);
  await held.refresh();
  expect(lines).toEqual(['reference pictures: catalog/reference, 0 items, 0 pictures, 0 in a frame call']);
  // A person copies three files into the folder while the server runs, as in the test of 2026-11-14.
  mkdirSync(join(dir, NUTELLA), { recursive: true });
  for (const name of ['1794678359369.jpg', '1794678359370.jpg', '1794678359371.jpg']) writeFileSync(join(dir, NUTELLA, name), jpeg(7));
  await held.refresh();
  await held.refresh();
  expect(lines.slice(1)).toEqual(['reference pictures: catalog/reference, 1 items, 3 pictures, 3 in a frame call']);
  expect(held.current()).toHaveLength(6);
  await store.remove(NUTELLA);
  await held.refresh();
  expect(held.current()).toEqual([]);
  expect(lines).toHaveLength(3);
});
it('says that the limit leaves items out', async () => {
  const many = numbered(MAX_FRAME_REFERENCES + 1);
  for (const { item } of many) await add(item.gtin, 1);
  await references(1, { entries: many }).refresh();
  expect(lines).toEqual([
    `reference pictures: catalog/reference, ${MAX_FRAME_REFERENCES + 1} items, ${MAX_FRAME_REFERENCES + 1} pictures, ${MAX_FRAME_REFERENCES} in a frame call. `
    + `1 items with pictures get none in a frame call: the limit is ${MAX_FRAME_REFERENCES} pictures and ${MAX_FRAME_REFERENCE_BYTES} bytes`,
  ]);
});
it('checks the folder again 10 seconds after the last check, from a call for the parts', async () => {
  let reads = 0;
  const counted: ReferenceImages = { ...store, all: () => { reads += 1; return store.all(); } };
  const held = references(1, { store: counted });
  await held.refresh();
  await add(NUTELLA, 1);
  now += FRAME_REFERENCES_CHECK_MS - 1001;
  for (let call = 0; call < 6; call += 1) expect(held.current()).toEqual([]);
  expect(reads).toBe(1);
  now += 1;
  // The call that starts the check still gets the older parts: no frame call waits for the disk.
  for (let call = 0; call < 6; call += 1) expect(held.current()).toEqual([]);
  expect(reads).toBe(2);
  await vi.waitFor(() => expect(held.current()).toHaveLength(2));
  expect(reads).toBe(2);
});
it('keeps the older parts when a read fails, and logs the failure', async () => {
  await add(NUTELLA, 1);
  const held = references(1, { store: { ...store, read: () => Promise.reject(new Error('disk gone')) } });
  await held.refresh();
  expect(held.current()).toEqual([]);
  expect(lines).toEqual(['reference pictures not read. disk gone']);
});
it('uploads a picture one time, gives a part that points to the file, and uploads again after 24 hours', async () => {
  type Sent = { url: string; headers: Headers; bytes: number };
  const sent: Sent[] = [];
  // The resumable upload of the Files API: the first call gives the address for the bytes, and the second call gives the file.
  const fetchStub: typeof fetch = async (input, init) => {
    const url = String(input);
    sent.push({ url, headers: new Headers(init?.headers), bytes: init?.body instanceof Blob ? init.body.size : -1 });
    if (url.endsWith('/files')) return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.test/session-1' } });
    return new Response(
      JSON.stringify({ file: { name: 'files/abc', uri: `https://files.test/abc-${sent.length}`, mimeType: 'image/jpeg' } }),
      { status: 200, headers: { 'x-goog-upload-status': 'final', 'content-type': 'application/json' } },
    );
  };
  await add(NUTELLA, 1, 9);
  const held = references(1, { picturePart: createPictureUploader({ apiKey: 'test-key', fetch: fetchStub }) });
  await held.refresh();
  expect(lines).toEqual([expect.stringContaining('1 in a frame call')]);
  expect(sent.map((call) => call.url)).toEqual([expect.stringMatching(/\/upload\/v1(beta)?\/files$/), expect.stringMatching(/\/session-1$/)]);
  expect(sent[0]!.headers.get('x-goog-api-key')).toBe('test-key');
  expect(sent[0]!.headers.get('x-goog-upload-header-content-type')).toBe('image/jpeg');
  expect(sent[1]!.bytes).toBe(9);
  expect(held.current()).toEqual([
    { text: 'Reference picture of gtin-3017624010701: Nutella' },
    { fileData: { fileUri: 'https://files.test/abc-2', mimeType: 'image/jpeg' }, mediaResolution: { level: 'MEDIA_RESOLUTION_LOW' } },
  ]);

  now += FRAME_REFERENCES_MAX_AGE_MS - 1;
  await held.refresh();
  expect(sent).toHaveLength(2);
  now += 1;
  await held.refresh();
  expect(sent).toHaveLength(4);
  expect(held.current()[1]).toMatchObject({ fileData: { fileUri: 'https://files.test/abc-4' } });
  // The pictures did not change, so the log has one line.
  expect(lines).toHaveLength(1);
});
it('holds no part when the upload fails, and tries again at the next check', async () => {
  let fail = true;
  const picturePart: PicturePart = async (bytes) => {
    if (fail) throw new Error('503 overloaded');
    return { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(bytes).toString('base64') } };
  };
  await add(NUTELLA, 1);
  const held = references(1, { picturePart });
  await held.refresh();
  expect(held.current()).toEqual([]);
  expect(lines).toEqual(['reference pictures not read. 503 overloaded']);
  fail = false;
  await held.refresh();
  expect(held.current()).toHaveLength(2);
});
it('reads the folder again at once when the server adds or removes a picture', async () => {
  const held = references(3);
  await held.refresh();
  const watched = refreshOnChange(store, held);
  now += 1000;
  await watched.add(NUTELLA, jpeg(1));
  await vi.waitFor(() => expect(held.current()).toHaveLength(2));
  expect(await watched.remove(NUTELLA)).toBe(1);
  await vi.waitFor(() => expect(held.current()).toEqual([]));
  expect(lines.map((line) => line.replace(/^.*pictures, /, ''))).toEqual(['0 in a frame call', '1 in a frame call', '0 in a frame call']);
});

it('shares one upload of a picture between the frame calls and the label calls, for 24 hours', async () => {
  const uploads: number[] = [];
  const upload: PicturePart = async (bytes) => {
    uploads.push(bytes[0]!);
    return { fileData: { fileUri: `files/${uploads.length}`, mimeType: 'image/jpeg' } };
  };
  const shared = sharePictureParts(upload, { now: () => now });
  const [first, again, other] = await Promise.all([shared(jpeg(1)), shared(jpeg(1)), shared(jpeg(2))]);
  expect(uploads).toEqual([1, 2]);
  expect(again).toBe(first);
  expect(other).toEqual({ fileData: { fileUri: 'files/2', mimeType: 'image/jpeg' } });
  now += FRAME_REFERENCES_MAX_AGE_MS - 1;
  expect(await shared(jpeg(1))).toBe(first);
  // The Files API deletes a picture after 48 hours.
  now += 1;
  expect(await shared(jpeg(1))).toEqual({ fileData: { fileUri: 'files/3', mimeType: 'image/jpeg' } });
});
it('does not keep an upload that failed', async () => {
  let fail = true;
  const upload: PicturePart = async () => {
    if (fail) throw new Error('503');
    return { fileData: { fileUri: 'files/1', mimeType: 'image/jpeg' } };
  };
  const shared = sharePictureParts(upload, { now: () => now });
  await expect(shared(jpeg(1))).rejects.toThrow('503');
  fail = false;
  expect(await shared(jpeg(1))).toEqual({ fileData: { fileUri: 'files/1', mimeType: 'image/jpeg' } });
});
