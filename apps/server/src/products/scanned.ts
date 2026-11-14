import type { Lang, Product } from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';
import { numberToWords } from '../speech/numbers';
import type { ProductDetails } from './productInfo';
import type { StoreItem } from './storeList';

const SCANNED_ID = /^gtin-(\d{13})$/;

/** The ID of a product of the store list that the catalog does not hold. A barcode, a label, or recognition by sight names it. */
export function scannedProductId(gtin13: string): string {
  return `gtin-${gtin13}`;
}

/** The 13 digits of the ID of a scanned product, or null for each other ID. */
export function gtinOfScannedId(productId: string): string | null {
  return SCANNED_ID.exec(productId)?.[1] ?? null;
}

/**
 * The products of the store list in this process, by ID. Each session shares them: a product is the same for each shopper.
 * The start of the server puts each store item here with the details that the cache holds, and each lookup puts a newer one.
 */
export class ScannedProducts {
  private readonly byId = new Map<string, Product>();

  get(id: string): Product | undefined {
    return this.byId.get(id);
  }

  /** A newer product with the same ID takes the place of the older one. */
  put(product: Product): void {
    this.byId.set(product.id, product);
  }
}

/**
 * The index that the rules use: the catalog, and then the scanned products.
 * `products` stays the catalog alone, so the clip seed holds no scanned product.
 */
export function withScanned(catalog: CatalogIndex, scanned: ScannedProducts): CatalogIndex {
  return { products: catalog.products, get: (id) => catalog.get(id) ?? scanned.get(id) };
}

type Unit = 'g' | 'kg' | 'ml' | 'cl' | 'l';
/** The singular and the plural of each unit. */
const UNITS: Record<Lang, Record<Unit, [string, string]>> = {
  en: { g: ['gram', 'grams'], kg: ['kilogram', 'kilograms'], ml: ['millilitre', 'millilitres'], cl: ['centilitre', 'centilitres'], l: ['litre', 'litres'] },
  it: { g: ['grammo', 'grammi'], kg: ['chilo', 'chili'], ml: ['millilitro', 'millilitri'], cl: ['centilitro', 'centilitri'], l: ['litro', 'litri'] },
};
const MAX_SPOKEN_PACK = 9999;

/**
 * A pack size as words: "500 g" is "five hundred grams" and "cinquecento grammi".
 * It knows one number with at most one decimal digit and the units g, kg, ml, cl, and l. Each other text stays as it is.
 */
export function spokenPack(packSize: string, lang: Lang): string {
  const match = /^(\d+)(?:[.,](\d))?\s*(g|kg|ml|cl|l)$/i.exec(packSize.trim());
  if (!match) return packSize;
  const whole = Number(match[1]);
  if (whole > MAX_SPOKEN_PACK) return packSize;
  const [singular, plural] = UNITS[lang][match[3]!.toLowerCase() as Unit];
  if (match[2] !== undefined) {
    return `${numberToWords(whole, lang)} ${lang === 'it' ? 'virgola' : 'point'} ${numberToWords(Number(match[2]), lang)} ${plural}`;
  }
  if (whole === 1) return `${lang === 'it' ? 'un' : 'one'} ${singular}`;
  return `${numberToWords(whole, lang)} ${plural}`;
}

const PLUS: Record<Lang, string> = { en: 'plus', it: 'più' };

/**
 * A store name as the voice says it: a plus sign becomes a word. A speech service can skip the sign or read it
 * in another language. The shown name keeps the sign.
 */
export function spokenStoreName(name: string, lang: Lang): string {
  return name.replace(/\s*\+\s*/g, ` ${PLUS[lang]} `).trim();
}

/** The pack of a product when no source gives its size. */
const UNKNOWN_PACK = { packSize: '1 pc', spoken: { en: 'one pack', it: 'una confezione' } };

/**
 * Builds the product of a store item. The store gives the name and the price, and its brand and pack size when it has them.
 * The name of the database is never used: its users write it, often in another language or as a part of the name.
 * The database gives the allergens and the diets. `details` is null when it gave nothing: the product then has no allergen data.
 * A product with no brand at all gets its name as the brand, so the detailed line says the name one time.
 */
export function scannedProduct(item: StoreItem, details: ProductDetails | null): Product {
  const name = { en: item.name, it: item.name };
  const packSize = item.packSize ?? details?.quantity ?? null;
  const pack = packSize === null
    ? UNKNOWN_PACK.spoken
    : { en: spokenPack(packSize, 'en'), it: spokenPack(packSize, 'it') };
  return {
    id: scannedProductId(item.gtin),
    gtin: item.gtin,
    name,
    spokenName: { en: spokenStoreName(item.name, 'en'), it: spokenStoreName(item.name, 'it') },
    brand: item.brand ?? details?.brand ?? item.name,
    packSize: packSize ?? UNKNOWN_PACK.packSize,
    spokenPack: pack,
    spokenPackDetailed: pack,
    priceCents: item.priceCents,
    allergens: details?.allergens ?? null,
    vegan: details?.vegan ?? null,
    vegetarian: details?.vegetarian ?? null,
    // The recognition prompt lists a store item with no look, so this text only fills the field.
    visual: `Store item with the barcode ${item.gtin}.`,
    lookAlikes: [],
  };
}
