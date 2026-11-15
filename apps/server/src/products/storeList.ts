import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { normalizeGtin } from '@glance/shared';

/** One item that the store sells. `gtin` has 13 digits. The price is in cents. */
export type StoreItem = { gtin: string; priceCents: number; name: string; brand?: string; packSize?: string };

/**
 * What the store sells, and at which price. A code that the list does not hold is not sold here.
 * It stands in for the ERP of the supermarket, so each call is a promise. A call that fails rejects.
 */
export interface StoreList {
  /** `gtin13` is a code of 13 digits with a right check digit. */
  byGtin(gtin13: string): Promise<StoreItem | undefined>;
  all(): Promise<readonly StoreItem[]>;
  /** Adds the item, or replaces the item that has its code. It resolves when the list is stored. */
  put(item: StoreItem): Promise<void>;
  /** Removes the item of a code of 13 digits. Resolves false when the list does not hold the code. */
  remove(gtin13: string): Promise<boolean>;
}

/** The part of the store list for a caller that only reads it. */
export type StoreListReader = Pick<StoreList, 'byGtin' | 'all'>;

/** The store list file when STORE_LIST_PATH is not set. */
export const DEFAULT_STORE_LIST_PATH = 'catalog/store-list.dev.json';

const EntrySchema = z.strictObject({
  gtin: z.string(),
  priceCents: z.number().int().positive(),
  name: z.string().min(1),
  brand: z.string().min(1).optional(),
  packSize: z.string().min(1).optional(),
});

/** One item as a line of the file: the keys in the order of the dev list, with one space after each colon and comma. */
function fileLine(code: string, item: StoreItem): string {
  const fields: [string, string | number | undefined][] = [
    ['gtin', code], ['priceCents', item.priceCents], ['name', item.name], ['brand', item.brand], ['packSize', item.packSize],
  ];
  return `  { ${fields.flatMap(([key, value]) => (value === undefined ? [] : `"${key}": ${JSON.stringify(value)}`)).join(', ')} }`;
}

/**
 * Reads a JSON array of store items. A code can have 8, 12, or 13 digits, and the list keeps it as 13 digits.
 * Throws an error that names the file and the entry for a bad field, a wrong check digit, and a code that the file holds two times.
 * `put` and `remove` write the whole file again, one item on each line, and then change the list in memory.
 * The text goes to a temp file that then takes the name, so a reader never gets a part of the file.
 * An item keeps its place and its code as the file had it, and a new item goes to the end.
 */
export function readStoreListFile(path: string): StoreList {
  let entries: unknown;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
    entries = JSON.parse(text);
  } catch (error) {
    throw new Error(`Cannot read the store list file ${path}: ${(error as Error).message}`, { cause: error });
  }
  if (!Array.isArray(entries)) throw new Error(`The store list file ${path} must hold a JSON array of items.`);

  let byGtin = new Map<string, StoreItem>();
  /** The code of each item as the file has it: 8, 12, or 13 digits. */
  const written = new Map<string, string>();
  entries.forEach((entry: unknown, index) => {
    const where = `The store list file ${path} has a bad entry ${index}.`;
    const parsed = EntrySchema.safeParse(entry);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'entry'}: ${issue.message}`).join(', ');
      throw new Error(`${where} ${issues}`);
    }
    const { gtin: code, brand, packSize, ...rest } = parsed.data;
    if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) throw new Error(`${where} gtin "${code}" must have 8, 12, or 13 digits.`);
    const gtin = normalizeGtin(code);
    if (gtin === null) throw new Error(`${where} gtin ${code} has a wrong check digit.`);
    if (byGtin.has(gtin)) throw new Error(`${where} The file holds the gtin ${gtin} two times.`);
    byGtin.set(gtin, { gtin, ...rest, ...(brand === undefined ? {} : { brand }), ...(packSize === undefined ? {} : { packSize }) });
    written.set(gtin, code);
  });

  let items = [...byGtin.values()];
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  /** Each write waits for the write before it, so two changes never write the file at one time. */
  let lastWrite: Promise<unknown> = Promise.resolve();
  /** `next` gives the new list, or null when the change changes nothing. */
  const change = <T>(next: () => { list: Map<string, StoreItem>; answer: T } | null, unchanged: T): Promise<T> => {
    const write = lastWrite.then(async () => {
      const changed = next();
      if (changed === null) return unchanged;
      const lines = [...changed.list.values()].map((item) => fileLine(written.get(item.gtin) ?? item.gtin, item));
      const body = lines.length === 0 ? `[]${newline}` : `[${newline}${lines.join(`,${newline}`)}${newline}]${newline}`;
      const temp = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, body);
        await rename(temp, path);
      } catch (error) {
        await rm(temp, { force: true }).catch(() => undefined);
        throw new Error(`Cannot write the store list file ${path}: ${(error as Error).message}`, { cause: error });
      }
      byGtin = changed.list;
      items = [...byGtin.values()];
      return changed.answer;
    });
    lastWrite = write.catch(() => undefined);
    return write;
  };

  return {
    byGtin: async (gtin13) => byGtin.get(gtin13),
    all: async () => items,
    put: (item) => change<void>(() => ({ list: new Map(byGtin).set(item.gtin, item), answer: undefined }), undefined),
    remove: (gtin13) => change(() => {
      if (!byGtin.has(gtin13)) return null;
      const list = new Map(byGtin);
      list.delete(gtin13);
      return { list, answer: true };
    }, false),
  };
}
