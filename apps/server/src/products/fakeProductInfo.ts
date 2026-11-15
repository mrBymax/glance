import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ProductInfo, parseOffAnswer } from './productInfo';

/** The folder of the fixtures, from the working directory apps/server. One file for each code: `<13 digits>.json`. */
export const FAKE_PRODUCT_INFO_DIR = 'fixtures/product-info';

/**
 * The reader of FAKE_PRODUCT_INFO. It makes no network call.
 * Each fixture is a saved answer of Open Food Facts. A code with no fixture is "not found".
 */
export function createFakeProductInfo(dir: string = FAKE_PRODUCT_INFO_DIR): ProductInfo {
  const byGtin: ProductInfo['byGtin'] = async (gtin13) => {
    // The code becomes a file name, so it must be digits only.
    if (!/^\d{13}$/.test(gtin13)) return null;
    let body: string;
    try {
      body = await readFile(join(dir, `${gtin13}.json`), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    return parseOffAnswer(JSON.parse(body));
  };
  // Each fixture is a file, so each read is a read with no network call.
  return { byGtin, cached: byGtin, holds: async () => true };
}
