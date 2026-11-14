import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Clock } from '../clock';

/** One stored picture of a store item. `read` of the store gives its JPEG. */
export type ReferenceImage = {
  /** 13 digits. */
  gtin: string;
  /** The name of the picture inside its item. */
  file: string;
  bytes: number;
  /** A clock value in milliseconds. */
  addedAt: number;
};

/**
 * The reference pictures of the store items: photos of each product, which the label call compares with a still.
 * Each `gtin` has 13 digits. `list` and `all` give no bytes, so a caller can select pictures before it reads one.
 * The folder store below is for a demo. The README says how a database can take its place.
 */
export interface ReferenceImages {
  /** The pictures of one item, newest first. */
  list(gtin: string): Promise<ReferenceImage[]>;
  /** Each item that has a picture, with its pictures, newest first. */
  all(): Promise<Map<string, ReferenceImage[]>>;
  add(gtin: string, jpeg: Uint8Array): Promise<ReferenceImage>;
  read(image: ReferenceImage): Promise<Uint8Array>;
  /** Removes each picture of one item. Returns the number of pictures that it removed. */
  remove(gtin: string): Promise<number>;
}

/** The folder when REFERENCE_DIR is not set. Git ignores it: a reference picture can show a room and people. */
export const DEFAULT_REFERENCE_DIR = 'catalog/reference';

/** A label call gets at most this number of pictures of one item: the newest ones. */
export const REFERENCES_FOR_ITEM = 3;
/**
 * The limits of one label call. The Gemini API takes at most 20 MB in one request with inline data, and base64
 * makes 12 MB of 9 MB. The still (2 MB at most on the device socket) and the instruction fit in the rest.
 * At the low media resolution one picture costs 280 tokens, so 24 pictures cost 6720 tokens.
 */
export const MAX_REFERENCES = 24;
export const MAX_REFERENCE_BYTES = 9_000_000;

const GTIN_13 = /^\d{13}$/;
const JPEG_FILE = /\.jpe?g$/i;

/**
 * Selects the pictures of one label call from `all`, for the items of the store list in the order of `gtins`.
 * Each item gets its newest picture before an item gets a second one, so the limits never leave an item out
 * while another item has three. A picture that does not fit in the byte limit is left out.
 * Returns the pictures of each item together, newest first.
 */
export function selectReferences(all: ReadonlyMap<string, readonly ReferenceImage[]>, gtins: readonly string[]): ReferenceImage[] {
  const selected = new Map<string, ReferenceImage[]>(gtins.map((gtin) => [gtin, []]));
  let count = 0;
  let bytes = 0;
  for (let rank = 0; rank < REFERENCES_FOR_ITEM; rank += 1) {
    for (const gtin of gtins) {
      const picture = all.get(gtin)?.[rank];
      if (!picture || count >= MAX_REFERENCES || bytes + picture.bytes > MAX_REFERENCE_BYTES) continue;
      selected.get(gtin)!.push(picture);
      count += 1;
      bytes += picture.bytes;
    }
  }
  return [...selected.values()].flat();
}

/**
 * The pictures as files: <dir>/<13 digits>/<name>.jpg. `add` names a file by the clock time in milliseconds.
 * A person can also copy a JPEG into the folder of an item. Such a file has the time of its last change.
 * Each call reads the folder again, so a new file counts with no restart.
 */
export function createFolderReferences(dir: string, clock: Clock): ReferenceImages {
  // The code becomes a folder name, so each other text stops here.
  const folderOf = (gtin: string): string => {
    if (!GTIN_13.test(gtin)) throw new Error(`A reference picture needs a code of 13 digits. Got "${gtin}".`);
    return join(dir, gtin);
  };
  const namesIn = async (folder: string): Promise<string[]> => {
    try {
      return await readdir(folder);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') return [];
      throw error;
    }
  };

  const list = async (gtin: string): Promise<ReferenceImage[]> => {
    const folder = folderOf(gtin);
    const files = (await namesIn(folder)).filter((name) => JPEG_FILE.test(name));
    const pictures = await Promise.all(files.map(async (file) => {
      const info = await stat(join(folder, file));
      const named = /^(\d+)\.jpg$/.exec(file);
      return { gtin, file, bytes: info.size, addedAt: named ? Number(named[1]) : Math.round(info.mtimeMs) };
    }));
    return pictures.sort((a, b) => b.addedAt - a.addedAt || b.file.localeCompare(a.file));
  };

  return {
    list,
    async all() {
      const items = new Map<string, ReferenceImage[]>();
      for (const gtin of (await namesIn(dir)).filter((name) => GTIN_13.test(name)).sort()) {
        const pictures = await list(gtin);
        if (pictures.length > 0) items.set(gtin, pictures);
      }
      return items;
    },
    async add(gtin, jpeg) {
      const folder = folderOf(gtin);
      await mkdir(folder, { recursive: true });
      let addedAt = clock.now();
      for (;;) {
        try {
          // 'wx' fails when the file exists, so two pictures of one millisecond get two names.
          await writeFile(join(folder, `${addedAt}.jpg`), jpeg, { flag: 'wx' });
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          addedAt += 1;
        }
      }
      return { gtin, file: `${addedAt}.jpg`, bytes: jpeg.length, addedAt };
    },
    read: async (image) => new Uint8Array(await readFile(join(folderOf(image.gtin), image.file))),
    async remove(gtin) {
      const folder = folderOf(gtin);
      const count = (await list(gtin)).length;
      await rm(folder, { recursive: true, force: true });
      return count;
    },
  };
}
