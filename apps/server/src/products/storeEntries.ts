import { type Product, normalizeGtin } from '@glance/shared';
import type { ProductDetails, ProductInfo } from './productInfo';
import type { StoreItem, StoreListReader } from './storeList';

/** One store item with the details that the product database held for it at the start of the server, or null. */
export type StoreEntry = { item: StoreItem; details: ProductDetails | null };

/**
 * Reads the whole store list one time, with the details that the reader of the product database holds.
 * It makes no network call, so the start of the server does not wait for the database.
 * The warm-up of warmup.ts reads the details of each item that the reader does not hold, after the start.
 * `log` gets one line for each item whose details the reader cannot give.
 */
export async function readStoreEntries(storeList: StoreListReader, info: ProductInfo, log: (line: string) => void): Promise<StoreEntry[]> {
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

/** The store entries of a consumer: a list that never changes, or a function that gives the list as it is now. */
export type EntriesSource = readonly StoreEntry[] | (() => readonly StoreEntry[]);

/**
 * What a consumer builds from the store entries, for example an instruction. The returned function builds it with
 * the first call, and again only when the source gives another list. `LiveStore.current` gives another list after each change.
 */
export function fromEntries<T>(source: EntriesSource, build: (entries: readonly StoreEntry[]) => T): () => T {
  let built: { entries: readonly StoreEntry[]; value: T } | null = null;
  return () => {
    const entries = typeof source === 'function' ? source() : source;
    if (built?.entries !== entries) built = { entries, value: build(entries) };
    return built.value;
  };
}
