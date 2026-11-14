import type { ProductDetails, ProductInfo } from './productInfo';
import type { StoreItem, StoreList } from './storeList';

/** One store item with the details that the product database held for it at the start of the server, or null. */
export type StoreEntry = { item: StoreItem; details: ProductDetails | null };

/**
 * Reads the whole store list one time, with the details that the reader of the product database holds.
 * It makes no network call: the database allows 15 reads each minute for one address, and a list can hold more items.
 * The details of an item that the reader does not hold come with its first prompt.
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
