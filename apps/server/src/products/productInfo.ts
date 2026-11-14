import { type Allergen, EU_ALLERGENS } from '@glance/shared';

/**
 * What a product database knows about one product. null means "no data" for each field.
 * It holds no name: the store list names each product. `allergens` is never an empty list: the database cannot tell "no allergen".
 */
export type ProductDetails = {
  brand: string | null;
  /** The pack size as text, for example "500 g". */
  quantity: string | null;
  allergens: Allergen[] | null;
  vegan: boolean | null;
  vegetarian: boolean | null;
};

/** The details of a product by its code. The store list holds the price, so this reader gives none. */
export interface ProductInfo {
  /** Resolves null when the database does not have the code. Rejects when the read fails. */
  byGtin(gtin13: string): Promise<ProductDetails | null>;
}

/** The tags of the allergens taxonomy of Open Food Facts for the 14 EU allergens. Each other tag has no allergen of the contract. */
export const OFF_ALLERGEN_TAGS: Record<string, Allergen> = {
  'en:gluten': 'gluten',
  'en:crustaceans': 'crustaceans',
  'en:eggs': 'eggs',
  'en:fish': 'fish',
  'en:peanuts': 'peanuts',
  'en:soybeans': 'soy',
  'en:milk': 'milk',
  'en:nuts': 'nuts',
  'en:celery': 'celery',
  'en:mustard': 'mustard',
  'en:sesame-seeds': 'sesame',
  'en:sulphur-dioxide-and-sulphites': 'sulphites',
  'en:lupin': 'lupin',
  'en:molluscs': 'molluscs',
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean === '' ? null : clean;
}

function tags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function mapped(list: readonly string[]): Allergen[] {
  return list.flatMap((tag) => OFF_ALLERGEN_TAGS[tag] ?? []);
}

/**
 * The allergens and the traces as one list. A shopper with an allergy must hear both.
 * With no allergen in the database the answer is null, also when traces exist: the list of a wheat pasta
 * with traces of mustard and no entry for gluten would read as "no gluten".
 */
function allergens(product: Record<string, unknown>): Allergen[] | null {
  const own = mapped(tags(product.allergens_tags));
  if (own.length === 0) return null;
  const found = new Set([...own, ...mapped(tags(product.traces_tags))]);
  return EU_ALLERGENS.filter((allergen) => found.has(allergen));
}

/** true for the tag `en:<diet>`, false for `en:non-<diet>`, and null for each other case. */
function diet(analysis: readonly string[], name: 'vegan' | 'vegetarian'): boolean | null {
  const yes = analysis.includes(`en:${name}`);
  const no = analysis.includes(`en:non-${name}`);
  if (yes === no) return null;
  return yes;
}

/** "400.0 g" and "500g" become "400 g" and "500 g". Each other text stays as it is. */
function quantity(value: unknown): string | null {
  const clean = text(value);
  const match = clean === null ? null : /^(\d+)(?:\.0+)?\s*([a-zA-Z]+)$/.exec(clean);
  return match ? `${match[1]} ${match[2]}` : clean;
}

/**
 * Reads the body of `GET /api/v2/product/<code>` of Open Food Facts. Returns null for "not found".
 * The database is written by its users, and its schema changes between versions.
 * So each field is read alone, and a field with a wrong type counts as no data.
 */
export function parseOffAnswer(body: unknown): ProductDetails | null {
  if (typeof body !== 'object' || body === null) return null;
  const { status, product } = body as { status?: unknown; product?: unknown };
  if (status === 0 || typeof product !== 'object' || product === null) return null;
  const fields = product as Record<string, unknown>;
  const analysis = tags(fields.ingredients_analysis_tags);
  return {
    brand: text(typeof fields.brands === 'string' ? fields.brands.split(',')[0] : null),
    quantity: quantity(fields.quantity),
    allergens: allergens(fields),
    vegan: diet(analysis, 'vegan'),
    vegetarian: diet(analysis, 'vegetarian'),
  };
}
