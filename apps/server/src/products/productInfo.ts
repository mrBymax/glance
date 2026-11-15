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
  /** The texts for the search by package text. Details that an older cache file holds have none. */
  texts?: ProductTexts;
};

/**
 * The words that a package can show, as the product database has them. The search of search/productSearch.ts
 * compares them with what a model read. No spoken line uses them: the store list names each product.
 */
export type ProductTexts = {
  /** The product name and the generic name, in each language that the database has. */
  names: string[];
  /** Each brand of the product. */
  brands: string[];
  /** The keywords of the database, and the words of its categories. */
  keywords: string[];
};

/** The details of a product by its code. The store list holds the price, so this reader gives none. */
export interface ProductInfo {
  /** Resolves null when the database does not have the code. Rejects when the read fails. */
  byGtin(gtin13: string): Promise<ProductDetails | null>;
  /**
   * The details that the reader holds now, with no network call. Resolves null when it holds none.
   * The start of the server reads the whole store list this way, because the database limits the reads of one address.
   */
  cached(gtin13: string): Promise<ProductDetails | null>;
  /**
   * True when a read of this code needs no network call now: the reader holds its details or its "not found",
   * or the reader never asks for this code. The warm-up of the start reads each other code.
   */
  holds(gtin13: string): Promise<boolean>;
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

/**
 * The languages whose product name and generic name the reader asks for. The database gives a name of a language
 * only when the request names its field. The list holds the languages of the demo and of the nearest markets.
 */
export const OFF_NAME_LANGS = ['en', 'fi', 'sv', 'it', 'de', 'fr', 'es', 'da', 'nb', 'et', 'nl', 'pl'] as const;

const NAME_FIELD = /^(product_name|generic_name)(_[a-z]{2})?$/;

/** Each text one time, in the order of the first one. The compare has no regard to case. */
function unique(list: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  return list.flatMap((value) => {
    if (value === null || seen.has(value.toLowerCase())) return [];
    seen.add(value.toLowerCase());
    return [value];
  });
}

/** "en:energy-drinks" becomes "energy drinks". */
function tagWords(tag: string): string | null {
  return text(tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
}

function texts(fields: Record<string, unknown>): ProductTexts {
  return {
    names: unique(Object.keys(fields).filter((key) => NAME_FIELD.test(key)).map((key) => text(fields[key]))),
    brands: unique(typeof fields.brands === 'string' ? fields.brands.split(',').map(text) : []),
    keywords: unique([...tags(fields._keywords).map(text), ...tags(fields.categories_tags).map(tagWords)]),
  };
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
    texts: texts(fields),
  };
}
