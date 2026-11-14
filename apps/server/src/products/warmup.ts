import type { ProductInfo } from './productInfo';
import type { ProductResolver } from './resolver';
import type { StoreEntry } from './storeEntries';

/** Open Food Facts allows 15 product reads each minute for one address. One read in this time is 12 each minute. */
export const WARM_UP_EVERY_MS = 5000;

/**
 * Reads the details of each store item that the product cache does not hold, in the background, one read at a time.
 * Without it, the first prompt of an item waits for its read of up to 2500 ms.
 * `resolver.resolve` makes the read and gives the rules the product with its details.
 * A read that fails is not tried again here: the first prompt of that item tries it.
 * `done` resolves when the last read ended, or after `stop`. It never rejects.
 */
export function startWarmUp(deps: {
  /** The store items that the catalog does not hold. */
  entries: readonly StoreEntry[];
  info: Pick<ProductInfo, 'holds'>;
  resolver: Pick<ProductResolver, 'resolve'>;
  log: (line: string) => void;
}): { stop(): void; done: Promise<void> } {
  let stopped = false;
  let wake: (() => void) | null = null;
  let timer: NodeJS.Timeout | undefined;
  const pause = (): Promise<void> => new Promise((resolve) => {
    wake = resolve;
    timer = setTimeout(resolve, WARM_UP_EVERY_MS);
  });
  const holds = (gtin: string): Promise<boolean> => deps.info.holds(gtin).catch(() => false);

  const run = async (): Promise<void> => {
    const startedAt = performance.now();
    const missing: string[] = [];
    for (const { item } of deps.entries) {
      if (!await holds(item.gtin)) missing.push(item.gtin);
    }
    if (stopped) return;
    deps.log(
      `product info: warm-up started. ${missing.length} of ${deps.entries.length} store items are not in the cache,`
      + ` one read each ${WARM_UP_EVERY_MS / 1000} s`,
    );
    let read = 0;
    for (const [index, gtin] of missing.entries()) {
      if (index > 0) await pause();
      if (stopped) return;
      // The resolver logs a read of the details that failed. A store list that fails rejects, and the next item still gets its read.
      await deps.resolver.resolve(gtin).catch(() => undefined);
      if (await holds(gtin)) read += 1;
    }
    if (stopped) return;
    deps.log(`product info: warm-up ended. read=${read} failed=${missing.length - read} ms=${Math.round(performance.now() - startedAt)}`);
  };

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      wake?.();
    },
    done: run().catch((error: unknown) => {
      deps.log(`product info: warm-up failed. ${error instanceof Error ? error.message : String(error)}`);
    }),
  };
}
