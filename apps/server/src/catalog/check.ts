import { type Lang, type Product, ProductSchema, hasGs1CheckDigit } from '@glance/shared';

export type CatalogReport = {
  /** The entries that pass the schema, with the first entry of each ID. */
  products: Product[];
  errors: string[];
  warnings: string[];
};

/** The number of products that the demo needs (spec section 11.3). */
const DEMO_PRODUCTS = 12;
const MIN_VISUAL_CHARS = 20;
const GTIN_LENGTHS = [8, 12, 13, 14];
const SPOKEN_FIELDS = ['name', 'spokenName', 'spokenPack', 'spokenPackDetailed'] as const;

function gtinError(gtin: string): string | null {
  if (!/^\d+$/.test(gtin) || !GTIN_LENGTHS.includes(gtin.length)) return 'gtin must have 8, 12, 13, or 14 digits';
  return hasGs1CheckDigit(gtin) ? null : 'gtin has a wrong check digit';
}

/** Missing allergen data is no difference: the voice can name a difference only when both lists exist. */
function differ(a: Product, b: Product): boolean {
  if (a.priceCents !== b.priceCents) return true;
  if (a.allergens === null || b.allergens === null) return false;
  return [...a.allergens].sort().join() !== [...b.allergens].sort().join();
}

/**
 * Checks a parsed catalog file. An error stops the seed, and a warning does not.
 * Each message starts with the product ID, with `entry <index>` for an entry with no ID, or with `catalog`.
 */
export function checkCatalog(input: unknown, opts: { lang?: Lang } = {}): CatalogReport {
  if (!Array.isArray(input)) return { products: [], errors: ['catalog: the input must be a JSON array of products'], warnings: [] };

  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map<string, Product>();

  input.forEach((entry: unknown, index) => {
    const parsed = ProductSchema.safeParse(entry);
    if (!parsed.success) {
      const id = (entry as { id?: unknown } | null)?.id;
      const label = typeof id === 'string' && id !== '' ? id : `entry ${index}`;
      for (const issue of parsed.error.issues) errors.push(`${label}: ${issue.path.join('.') || 'entry'} ${issue.message}`);
      return;
    }
    const product = parsed.data;
    if (byId.has(product.id)) {
      errors.push(`${product.id}: duplicate id`);
      return;
    }
    byId.set(product.id, product);
  });
  const products = [...byId.values()];

  let pairDiffers = false;
  for (const product of products) {
    const { id } = product;
    if (product.priceCents === 0) errors.push(`${id}: priceCents is 0`);

    for (const otherId of product.lookAlikes) {
      const other = byId.get(otherId);
      if (otherId === id) errors.push(`${id}: look-alike ${otherId} is the product itself`);
      else if (!other) errors.push(`${id}: look-alike ${otherId} does not exist`);
      else {
        if (!other.lookAlikes.includes(id)) errors.push(`${id}: look-alike ${otherId} does not list it back`);
        if (differ(product, other)) pairDiffers = true;
      }
    }

    if (product.gtin !== undefined) {
      const error = gtinError(product.gtin);
      if (error) errors.push(`${id}: ${error}`);
    }

    if (opts.lang === 'it') {
      for (const field of SPOKEN_FIELDS) {
        if (product[field].it === undefined) errors.push(`${id}: ${field} has no Italian text`);
      }
    }

    if (product.allergens === null) warnings.push(`${id}: no allergen data`);
    if (product.visual.length < MIN_VISUAL_CHARS) warnings.push(`${id}: visual is too short for the prompt`);
    // The recognition prompt prints each product on one line, with bars between its fields.
    if (/[\r\n|]/.test(product.visual)) warnings.push(`${id}: visual must be one line with no vertical bar`);
  }

  if (!pairDiffers) errors.push('catalog: no look-alike pair differs in price or allergens');
  if (products.length < DEMO_PRODUCTS) warnings.push(`catalog: ${products.length} products, the demo needs ${DEMO_PRODUCTS}`);
  return { products, errors, warnings };
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** The output of catalog:check: one line for each error and each warning, then the counts. */
export function reportLines(report: CatalogReport): string[] {
  return [
    ...report.errors.map((message) => `error: ${message}`),
    ...report.warnings.map((message) => `warning: ${message}`),
    `catalog: ${count(report.products.length, 'product')}, ${count(report.errors.length, 'error')}, ${count(report.warnings.length, 'warning')}`,
  ];
}
