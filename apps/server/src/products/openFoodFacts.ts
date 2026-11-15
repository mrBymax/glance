// The call of https://openfoodfacts.github.io/openfoodfacts-server/api/ : GET /api/v2/product/<code>
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { AllergenSchema, isStoreInternalGtin } from '@glance/shared';
import { type Clock, systemClock } from '../clock';
import type { FetchFn } from '../speech/elevenlabs';
import { OFF_NAME_LANGS, type ProductDetails, type ProductInfo, parseOffAnswer } from './productInfo';

export const DEFAULT_OFF_BASE_URL = 'https://world.openfoodfacts.org';
/** Open Food Facts asks each app for a User-Agent with its name, its version, and a contact. */
export const DEFAULT_PRODUCT_INFO_USER_AGENT = 'MetaGlance/0.1 (https://github.com/mrBymax/glance)';
export const DEFAULT_PRODUCT_CACHE_DIR = '.cache/products';
/** The lookup of a barcode has 2500 ms, and the store list answers first. */
export const OFF_TIMEOUT_MS = 2000;
export const OFF_HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A product that the database does not have can get its page the next day. */
export const OFF_MISS_TTL_MS = 24 * 60 * 60 * 1000;
/** The phone repeats a barcode each second. After a failed request, the next request for that code waits this time. */
export const OFF_RETRY_AFTER_MS = 30_000;
/** The status 429 says that the address read too much. The database can block an address that goes on, so each code waits. */
export const OFF_PAUSE_AFTER_429_MS = 60_000;

/**
 * The version of the cache files. Version 2 added the texts for the search by package text. A file of an older
 * version still gives its details, and the warm-up of the start reads its product again.
 */
export const OFF_CACHE_VERSION = 2;

const FIELDS = [
  'code,brands,quantity,allergens_tags,traces_tags,ingredients_analysis_tags,product_name,generic_name,_keywords,categories_tags',
  ...OFF_NAME_LANGS.map((lang) => `product_name_${lang},generic_name_${lang}`),
].join(',');
const LOGGED_BODY_CHARS = 200;

type Cached = { version?: number; fetchedAt: number; details: ProductDetails | null };

const CachedSchema: z.ZodType<Cached> = z.object({
  version: z.number().optional(),
  fetchedAt: z.number(),
  details: z.object({
    brand: z.string().nullable(),
    quantity: z.string().nullable(),
    allergens: z.array(AllergenSchema).nullable(),
    vegan: z.boolean().nullable(),
    vegetarian: z.boolean().nullable(),
    texts: z.object({ names: z.array(z.string()), brands: z.array(z.string()), keywords: z.array(z.string()) }).optional(),
  }).nullable(),
});

/**
 * The code as the database stores it: 8 digits for a short code, else 13.
 * The database does the same with the code of a request, so this only makes the address the one of the product.
 */
function offCode(gtin13: string): string {
  const short = gtin13.replace(/^0+/, '');
  return short.length <= 8 ? short.padStart(8, '0') : gtin13;
}

/**
 * Reads the details of a product from Open Food Facts, with a cache in memory and in files.
 * The database allows 15 product reads each minute for one address, and each shopper shares the address of the server.
 * So a hit stays for 30 days and a miss for 1 day, and the calls for one code that run together share one request.
 * A failed read is not kept as an answer, and the next request for its code waits 30 seconds.
 * After the status 429 each code waits 60 seconds. `fetch` takes the place of the global fetch in a test.
 */
export function createOpenFoodFactsInfo(deps: {
  baseUrl: string; userAgent: string; cacheDir: string;
  fetch?: FetchFn; clock?: Clock;
  /** Gets one line for each cache file that fails. The default is console.error. */
  log?: (line: string) => void;
}): ProductInfo {
  const fetchFn = deps.fetch ?? fetch;
  const clock = deps.clock ?? systemClock;
  const log = deps.log ?? ((line: string) => console.error(line));
  const base = deps.baseUrl.replace(/\/+$/, '');
  const memory = new Map<string, Cached>();
  /** The requests that run now, by code. */
  const running = new Map<string, Promise<ProductDetails | null>>();
  /** The time of the last failed request of each code. The codes are those of the store list, so the map stays small. */
  const failedAt = new Map<string, number>();
  let pausedUntil = 0;

  const fresh = (entry: Cached): boolean => clock.now() - entry.fetchedAt < (entry.details === null ? OFF_MISS_TTL_MS : OFF_HIT_TTL_MS);
  /** False for a hit of a file of an older version: it has no texts for the search, so the product needs a new read. */
  const complete = (entry: Cached): boolean => entry.details === null || entry.version === OFF_CACHE_VERSION;
  const filePath = (gtin13: string): string => join(deps.cacheDir, `${gtin13}.json`);

  const readFileEntry = async (gtin13: string): Promise<Cached | null> => {
    let body: string;
    try {
      body = await readFile(filePath(gtin13), 'utf8');
    } catch {
      return null;
    }
    try {
      return CachedSchema.parse(JSON.parse(body));
    } catch {
      log(`product info: cache file not read, the server asks again. gtin=${gtin13}`);
      return null;
    }
  };

  const writeFileEntry = async (gtin13: string, entry: Cached): Promise<void> => {
    // A reader must never get a part of a file, so the text goes to a temp file that then takes the name.
    const temp = join(deps.cacheDir, `${gtin13}.${randomUUID()}.tmp`);
    try {
      await mkdir(deps.cacheDir, { recursive: true });
      await writeFile(temp, JSON.stringify({ version: OFF_CACHE_VERSION, gtin: gtin13, fetchedAt: entry.fetchedAt, details: entry.details }));
      await rename(temp, filePath(gtin13));
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      log(`product info: cache file not written. gtin=${gtin13} ${(error as Error).message}`);
    }
  };

  const request = async (gtin13: string): Promise<ProductDetails | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(new DOMException('The call to Open Food Facts timed out.', 'TimeoutError')), OFF_TIMEOUT_MS);
    try {
      const response = await fetchFn(`${base}/api/v2/product/${offCode(gtin13)}?fields=${FIELDS}`, {
        headers: { 'user-agent': deps.userAgent, accept: 'application/json' },
        signal: abort.signal,
      });
      const body = await response.text();
      // A product that the database does not have gets the status 404. Older versions answer 200 with "status": 0.
      if (response.status === 404) return null;
      if (response.status === 429) pausedUntil = clock.now() + OFF_PAUSE_AFTER_429_MS;
      if (response.status !== 200) throw new Error(`Open Food Facts answered ${response.status}. ${body.slice(0, LOGGED_BODY_CHARS)}`.trim());
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error('Open Food Facts answered 200 with a body that is no JSON.');
      }
      const details = parseOffAnswer(json);
      // Only "status": 0 says "not found". Each other body with no product is not an answer of the database,
      // for example the page of a proxy, and it must not stay in the cache as a miss.
      const notFound = typeof json === 'object' && json !== null && (json as { status?: unknown }).status === 0;
      if (details === null && !notFound) throw new Error('Open Food Facts answered 200 with no product.');
      return details;
    } finally {
      clearTimeout(timer);
    }
  };

  const load = async (gtin13: string): Promise<ProductDetails | null> => {
    const stored = memory.get(gtin13) ?? await readFileEntry(gtin13);
    const kept = stored && fresh(stored) ? stored : null;
    if (kept) {
      memory.set(gtin13, kept);
      if (complete(kept)) return kept.details;
    }
    let details: ProductDetails | null;
    try {
      const now = clock.now();
      if (now < pausedUntil) {
        throw new Error(`Open Food Facts answered 429. It allows no call for ${Math.ceil((pausedUntil - now) / 1000)} s.`);
      }
      const failed = failedAt.get(gtin13);
      if (failed !== undefined && now - failed < OFF_RETRY_AFTER_MS) {
        throw new Error(`The call to Open Food Facts failed ${Math.round((now - failed) / 1000)} s ago. The next call for this code waits.`);
      }
      try {
        details = await request(gtin13);
      } catch (error) {
        failedAt.set(gtin13, clock.now());
        throw error;
      }
    } catch (error) {
      // The file of an older version still has the allergens. The texts for the search wait for the next read.
      if (kept) return kept.details;
      throw error;
    }
    failedAt.delete(gtin13);
    const entry: Cached = { version: OFF_CACHE_VERSION, fetchedAt: clock.now(), details };
    memory.set(gtin13, entry);
    await writeFileEntry(gtin13, entry);
    return entry.details;
  };

  // The database gives its own 200... codes to products with no barcode, so a hit for a store code is no match.
  const known = (gtin13: string): boolean => /^\d{13}$/.test(gtin13) && !isStoreInternalGtin(gtin13);

  /** The answer that the memory or a file holds for a code, or null. */
  const keptEntry = async (gtin13: string): Promise<Cached | null> => {
    const kept = memory.get(gtin13) ?? await readFileEntry(gtin13);
    if (!kept || !fresh(kept)) return null;
    memory.set(gtin13, kept);
    return kept;
  };
  return {
    async cached(gtin13) {
      return known(gtin13) ? (await keptEntry(gtin13))?.details ?? null : null;
    },
    async holds(gtin13) {
      if (!known(gtin13)) return true;
      const kept = await keptEntry(gtin13);
      return kept !== null && complete(kept);
    },
    async byGtin(gtin13) {
      if (!known(gtin13)) return null;
      const kept = memory.get(gtin13);
      if (kept && fresh(kept) && complete(kept)) return kept.details;

      let call = running.get(gtin13);
      if (!call) {
        // A failed request leaves the map, so a later call for this code can try again.
        call = load(gtin13).finally(() => running.delete(gtin13));
        running.set(gtin13, call);
      }
      return call;
    },
  };
}
