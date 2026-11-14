import { type Product, normalizeGtin } from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';
import type { ProductDetails, ProductInfo } from './productInfo';
import { type ScannedProducts, scannedProduct } from './scanned';
import type { StoreList } from './storeList';

/** One lookup has this time: the store list first, then the database with what is left. */
export const BARCODE_LOOKUP_MS = 2500;

const LATE = Symbol('late');

/** Finds the product of a barcode: in the catalog, else in the store list with the details of the product database. */
export class ProductResolver {
  /** The catalog products that have a code, by its 13 digits. */
  private readonly catalogByGtin = new Map<string, Product>();
  private readonly budgetMs: number;

  constructor(private readonly deps: {
    catalog: CatalogIndex; storeList: StoreList; info: ProductInfo;
    /** Gets each product that the catalog does not hold. */
    scanned: ScannedProducts;
    budgetMs?: number;
    /** Gets one line for each lookup with no details. The default is console.error. */
    log?: (line: string) => void;
  }) {
    this.budgetMs = deps.budgetMs ?? BARCODE_LOOKUP_MS;
    for (const product of deps.catalog.products) {
      const gtin = product.gtin === undefined ? null : normalizeGtin(product.gtin);
      if (gtin !== null) this.catalogByGtin.set(gtin, product);
    }
  }

  /** The catalog product with this code, if one exists. It has its own price and spoken texts. */
  catalogProduct(gtin13: string): Product | undefined {
    return this.catalogByGtin.get(gtin13);
  }

  /**
   * Returns the product of a code of 13 digits, or null when the store does not sell it.
   * A catalog product with the code wins. Each other product is built again with each call, so details
   * that came late the last time are in the next product.
   * Rejects when the store list fails or does not answer inside the budget.
   * A database that fails or is late is no failure: the product then has the name of the store and no allergen data.
   */
  async resolve(gtin13: string): Promise<Product | null> {
    const fromCatalog = this.catalogByGtin.get(gtin13);
    if (fromCatalog) return fromCatalog;

    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<typeof LATE>((resolve) => {
      timer = setTimeout(() => resolve(LATE), this.budgetMs);
    });
    try {
      const item = await Promise.race([this.deps.storeList.byGtin(gtin13), late]);
      if (item === LATE) throw new Error(`The store list did not answer in ${this.budgetMs} ms.`);
      if (item === undefined) return null;

      const noDetails = (cause: string): null => {
        (this.deps.log ?? console.error)(`product info: no details. gtin=${gtin13} ${cause}`);
        return null;
      };
      // The request goes on after the budget, and its answer fills the cache for the next scan.
      const read: Promise<ProductDetails | null> = this.deps.info.byGtin(gtin13).catch((error: unknown) => (
        noDetails(error instanceof Error ? error.message : String(error))
      ));
      const answer = await Promise.race([read, late]);
      const details = answer === LATE ? noDetails(`no answer in ${this.budgetMs} ms`) : answer;

      const product = scannedProduct(item, details);
      this.deps.scanned.put(product);
      return product;
    } finally {
      clearTimeout(timer);
    }
  }
}
