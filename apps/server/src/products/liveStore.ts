import type { ProductInfo } from './productInfo';
import { type StoreEntry, readStoreEntries } from './storeEntries';
import type { StoreItem, StoreList } from './storeList';

/** One change of the store list while the server runs. */
export type StoreChange = { kind: 'put'; entry: StoreEntry } | { kind: 'remove'; gtin: string };

/**
 * The store list of a server that runs: the entries as they are now, and the one signal for each change.
 * Each part of the server that builds something from the list reads `current` with each use, or listens here.
 * So an item that a person adds counts with no restart, also for a session that runs.
 */
export type LiveStore = {
  /** The entries as they are now, in the order of the store list. Each change gives a new list, so a caller can compare two lists with `===`. */
  current(): readonly StoreEntry[];
  /** Stores the item, with the details that the reader of the product database holds, and tells each listener. */
  put(item: StoreItem): Promise<StoreEntry>;
  /** Resolves false, and tells no listener, when the list does not hold the code of 13 digits. */
  remove(gtin13: string): Promise<boolean>;
  /** `listener` runs after each change, when `current` already gives the new list. */
  onChange(listener: (change: StoreChange) => void): void;
};

/** Reads the store list one time, as `readStoreEntries` does, and follows each change that goes through `put` and `remove`. */
export async function openLiveStore(storeList: StoreList, info: ProductInfo, log: (line: string) => void): Promise<LiveStore> {
  let entries: readonly StoreEntry[] = await readStoreEntries(storeList, info, log);
  const listeners: ((change: StoreChange) => void)[] = [];
  const tell = (change: StoreChange): void => {
    for (const listener of listeners) listener(change);
  };

  return {
    current: () => entries,
    async put(item) {
      await storeList.put(item);
      const details = await info.cached(item.gtin).catch((error: unknown) => {
        log(`product info: no details for the new item. gtin=${item.gtin} ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      const entry: StoreEntry = { item, details };
      const known = entries.some((other) => other.item.gtin === item.gtin);
      entries = known ? entries.map((other) => (other.item.gtin === item.gtin ? entry : other)) : [...entries, entry];
      tell({ kind: 'put', entry });
      return entry;
    },
    async remove(gtin13) {
      if (!await storeList.remove(gtin13)) return false;
      entries = entries.filter((entry) => entry.item.gtin !== gtin13);
      tell({ kind: 'remove', gtin: gtin13 });
      return true;
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
