import { readFileSync } from 'node:fs';
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
}

/** The store list file when STORE_LIST_PATH is not set. */
export const DEFAULT_STORE_LIST_PATH = 'catalog/store-list.dev.json';

const EntrySchema = z.strictObject({
  gtin: z.string(),
  priceCents: z.number().int().positive(),
  name: z.string().min(1),
  brand: z.string().min(1).optional(),
  packSize: z.string().min(1).optional(),
});

/**
 * Reads a JSON array of store items. A code can have 8, 12, or 13 digits, and the list keeps it as 13 digits.
 * Throws an error that names the file and the entry for a bad field, a wrong check digit, and a code that the file holds two times.
 */
export function readStoreListFile(path: string): StoreList {
  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the store list file ${path}: ${(error as Error).message}`, { cause: error });
  }
  if (!Array.isArray(entries)) throw new Error(`The store list file ${path} must hold a JSON array of items.`);

  const byGtin = new Map<string, StoreItem>();
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
  });

  const items = [...byGtin.values()];
  return { byGtin: async (gtin13) => byGtin.get(gtin13), all: async () => items };
}
