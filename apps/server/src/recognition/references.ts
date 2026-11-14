import { GoogleGenAI, type Part, PartMediaResolutionLevel } from '@google/genai';
import { type Product, normalizeGtin } from '@glance/shared';
import type { Clock } from '../clock';
import { referencePicturePart } from '../label/gemini';
import { scannedProductId } from '../products/scanned';
import type { StoreEntry } from '../products/storeEntries';
import type { ReferenceImage, ReferenceImages } from '../reference/images';

/**
 * The limits of one frame call. A session makes about 7 frame calls each second, and each call pays the tokens of
 * its pictures, so the limits are lower than those of a label call. 12 pictures cost 3360 tokens at the low media
 * resolution. The byte limit keeps a request with the bytes of its pictures small, for a caller with no uploader.
 */
export const MAX_FRAME_REFERENCES = 12;
export const MAX_FRAME_REFERENCE_BYTES = 2_000_000;

/** The time between two checks of the folder. A new picture counts in a frame call after this time at most. */
export const FRAME_REFERENCES_CHECK_MS = 10_000;

/** The Files API deletes a picture after 48 hours, so the parts are built again after this time. */
export const FRAME_REFERENCES_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type FrameReferences = {
  /** The parts that a frame call starts with: for each picture a text part with its product, then the image. */
  parts: Part[];
  /** The items and the pictures of `parts`. */
  items: number;
  pictures: number;
  /** The store items with pictures that got none, because of the limits. */
  leftOut: number;
  /** The items and the pictures that the store holds, also for a code outside the store list. */
  storedItems: number;
  storedPictures: number;
  /** Changes when a picture of `parts` changes, or a count. */
  state: string;
};

type Selected = { id: string; name: string; pictures: ReferenceImage[] };

/**
 * Selects the pictures of a frame call: the `perItem` newest pictures of each store item, in the order of the store list.
 * An item gets each of its pictures or none. The first item that does not fit in the limits ends the list, so the
 * items with pictures are always the first ones of the store list.
 * A store item that the catalog holds has the ID and the name of its catalog product, as in the instruction.
 */
function selectFrameReferences(
  all: ReadonlyMap<string, readonly ReferenceImage[]>, entries: readonly StoreEntry[], products: readonly Product[], perItem: number,
): { selected: Selected[]; leftOut: number } {
  const inCatalog = new Map(products.flatMap((product) => {
    const gtin = product.gtin === undefined ? null : normalizeGtin(product.gtin);
    return gtin === null ? [] : [[gtin, product] as const];
  }));
  const selected: Selected[] = [];
  let count = 0;
  let bytes = 0;
  let leftOut = 0;
  for (const { item } of entries) {
    const pictures = (all.get(item.gtin) ?? []).slice(0, perItem);
    if (pictures.length === 0) continue;
    const size = pictures.reduce((sum, picture) => sum + picture.bytes, 0);
    if (leftOut > 0 || count + pictures.length > MAX_FRAME_REFERENCES || bytes + size > MAX_FRAME_REFERENCE_BYTES) {
      leftOut += 1;
      continue;
    }
    const product = inCatalog.get(item.gtin);
    selected.push({ id: product?.id ?? scannedProductId(item.gtin), name: product?.name.en ?? item.name, pictures: [...pictures] });
    count += pictures.length;
    bytes += size;
  }
  return { selected, leftOut };
}

/** Makes the image part of one picture. */
export type PicturePart = (jpeg: Uint8Array) => Promise<Part>;

/**
 * Sends a picture to the Files API of Gemini one time, and gives a part that points to the file.
 * A frame call then uploads no picture: 3 pictures of 130 kB in each of 7 calls a second are 27 Mbit/s.
 * The API deletes a file after 48 hours.
 */
export function createPictureUploader(deps: { apiKey: string; fetch?: typeof fetch }): PicturePart {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  return async (jpeg) => {
    const file = await ai.files.upload({ file: new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), config: { mimeType: 'image/jpeg' } });
    if (!file.uri) throw new Error('The Files API gave no address for a reference picture.');
    return { fileData: { fileUri: file.uri, mimeType: 'image/jpeg' }, mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW } };
  };
}

/** Reads the folder one time and builds the parts of a frame call. `perItem` 0 gives no part. */
export async function loadFrameReferences(
  store: ReferenceImages, entries: readonly StoreEntry[], products: readonly Product[], perItem: number,
  /** The result of the last read. With the same pictures, the function returns it and reads no file. */
  last?: FrameReferences,
  /** With none, the part holds the bytes of the picture, as in a label call. */
  picturePart: PicturePart = async (jpeg) => referencePicturePart(jpeg),
): Promise<FrameReferences> {
  const all = await store.all();
  const { selected, leftOut } = selectFrameReferences(all, entries, products, perItem);
  const stored = [...all.values()];
  const counts = { leftOut, storedItems: stored.length, storedPictures: stored.flat().length };
  const state = JSON.stringify([counts, selected.map(({ id, pictures }) => [id, pictures.map((picture) => [picture.file, picture.bytes, picture.addedAt])])]);
  if (last?.state === state) return last;
  const parts = (await Promise.all(selected.map(({ id, name, pictures }) => Promise.all(pictures.map(async (picture): Promise<Part[]> => [
    { text: `Reference picture of ${id}: ${name}` }, await picturePart(await store.read(picture)),
  ]))))).flat(2);
  return { parts, items: selected.length, pictures: parts.length / 2, ...counts, state };
}

/**
 * Holds the parts of the reference pictures for the frame calls of each session, so no call reads a file.
 * `refresh` reads the state of the folder, and reads the files only when a selected picture changed.
 * `current` gives the parts as they are, and starts a refresh when the last one is 10 seconds old.
 * Each change of the pictures gets one log line, so the log shows a picture that arrives after the start.
 */
export function createFrameReferences(deps: {
  store: ReferenceImages;
  /** The store list as it was at the start of the server. */
  entries: readonly StoreEntry[];
  /** The catalog products. */
  products: readonly Product[];
  /** The number of pictures of one item in a frame call. 0: a frame call gets no picture. */
  perItem: number;
  /** With none, each part holds the bytes of its picture. */
  picturePart?: PicturePart;
  /** The folder, for the log line. */
  dir: string;
  clock: Clock;
  log: (line: string) => void;
}): { current(): readonly Part[]; refresh(): Promise<void> } {
  let held: FrameReferences | undefined;
  let builtAt = -Infinity;
  let checkedAt = -Infinity;
  let running: Promise<void> | null = null;
  /** A refresh was asked for while a read ran. That read can be older than the change, so one more read follows it. */
  let again = false;

  const read = async (): Promise<void> => {
    try {
      const fresh = deps.clock.now() - builtAt < FRAME_REFERENCES_MAX_AGE_MS ? held : undefined;
      const loaded = await loadFrameReferences(deps.store, deps.entries, deps.products, deps.perItem, fresh, deps.picturePart);
      if (loaded === held) return;
      const changed = loaded.state !== held?.state;
      held = loaded;
      builtAt = deps.clock.now();
      if (!changed) return;
      deps.log(
        `reference pictures: ${deps.dir}, ${loaded.storedItems} items, ${loaded.storedPictures} pictures, ${loaded.pictures} in a frame call`
        + (loaded.leftOut === 0 ? '' : `. ${loaded.leftOut} items with pictures get none in a frame call: the limit is ${MAX_FRAME_REFERENCES} pictures and ${MAX_FRAME_REFERENCE_BYTES} bytes`),
      );
    } catch (error) {
      deps.log(`reference pictures not read. ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const refresh = (): Promise<void> => {
    checkedAt = deps.clock.now();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await read();
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    current() {
      if (deps.clock.now() - checkedAt >= FRAME_REFERENCES_CHECK_MS) void refresh();
      return held?.parts ?? [];
    },
    refresh,
  };
}

/** The store, with a refresh of the held parts after each picture that the server adds or removes. */
export function refreshOnChange(store: ReferenceImages, held: { refresh(): Promise<void> }): ReferenceImages {
  return {
    ...store,
    async add(gtin, jpeg) {
      const picture = await store.add(gtin, jpeg);
      void held.refresh();
      return picture;
    },
    async remove(gtin) {
      const count = await store.remove(gtin);
      void held.refresh();
      return count;
    },
  };
}
