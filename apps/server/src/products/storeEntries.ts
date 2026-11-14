import { type Product, normalizeGtin } from '@glance/shared';
import type { ProductDetails, ProductInfo } from './productInfo';
import type { StoreItem, StoreList } from './storeList';

/** One store item with the details that the product database held for it at the start of the server, or null. */
export type StoreEntry = { item: StoreItem; details: ProductDetails | null };

/**
 * Reads the whole store list one time, with the details that the reader of the product database holds.
 * It makes no network call, so the start of the server does not wait for the database.
 * The warm-up of warmup.ts reads the details of each item that the reader does not hold, after the start.
 * `log` gets one line for each item whose details the reader cannot give.
 */
export async function readStoreEntries(storeList: StoreList, info: ProductInfo, log: (line: string) => void): Promise<StoreEntry[]> {
  const items = await storeList.all();
  return Promise.all(items.map(async (item) => {
    const details = await info.cached(item.gtin).catch((error: unknown) => {
      log(`product info: no details at the start. gtin=${item.gtin} ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    return { item, details };
  }));
}

/**
 * The entries whose code no catalog product has. A catalog product wins for its code,
 * so recognition by sight must not get that product a second time, as a store item.
 */
export function notInCatalog(entries: readonly StoreEntry[], products: readonly Product[]): StoreEntry[] {
  const inCatalog = new Set(products.flatMap((product) => (product.gtin === undefined ? [] : normalizeGtin(product.gtin) ?? [])));
  return entries.filter((entry) => !inCatalog.has(entry.item.gtin));
}
