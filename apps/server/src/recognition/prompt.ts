import { z } from 'zod';
import { AimHintSchema, type Product } from '@glance/shared';
import { scannedProductId } from '../products/scanned';
import type { StoreEntry } from '../products/storeEntries';

const CATALOG_PLACEHOLDER = '{{catalog}}';
const STORE_ITEMS_PLACEHOLDER = '{{storeItems}}';

/**
 * Puts the catalog and the store items into the instruction template, one line for each product.
 * A store item has the ID of a scanned product, and no look: the store list does not describe a package.
 * Its brand and pack size come from the store list, else from the details of the product database.
 * No line holds a price: the model names a product, and the price comes from the catalog or the store list.
 */
export function buildSystemInstruction(template: string, products: readonly Product[], storeEntries: readonly StoreEntry[]): string {
  for (const placeholder of [CATALOG_PLACEHOLDER, STORE_ITEMS_PLACEHOLDER]) {
    if (!template.includes(placeholder)) throw new Error(`The recognition instruction has no ${placeholder} placeholder.`);
  }
  const lines = products.map((product) => {
    const line = `- id: ${product.id} | name: ${product.name.en} | brand: ${product.brand} | pack: ${product.packSize} | look: ${product.visual}`;
    return product.lookAlikes.length > 0 ? `${line} | lookAlikes: ${product.lookAlikes.join(', ')}` : line;
  });
  const storeLines = storeEntries.map(({ item, details }) => {
    const brand = item.brand ?? details?.brand ?? null;
    const pack = item.packSize ?? details?.quantity ?? null;
    return `- id: ${scannedProductId(item.gtin)} | name: ${item.name}${brand === null ? '' : ` | brand: ${brand}`}${pack === null ? '' : ` | pack: ${pack}`}`;
  });
  // A function as the replacement keeps a "$" of a product text as it is.
  return template
    .replace(CATALOG_PLACEHOLDER, () => (lines.length > 0 ? lines.join('\n') : '(The catalog is empty.)'))
    .replace(STORE_ITEMS_PLACEHOLDER, () => (storeLines.length > 0 ? storeLines.join('\n') : '(The store has no other items.)'));
}

/**
 * The JSON Schema of the answer: the six fields of spec section 11.1, and the code of the frame.
 * The product fields take only the given IDs, so the model cannot write an ID outside the catalog and the store list.
 */
export function recognitionResponseSchema(productIds: readonly string[]): unknown {
  const id = z.enum(productIds as [string, ...string[]]);
  return z.toJSONSchema(z.object({
    status: z.enum(['identified', 'ambiguous', 'unsure', 'unknown', 'none']),
    productId: id.nullable(),
    candidates: z.array(id),
    confidence: z.number().min(0).max(1),
    aimHint: AimHintSchema,
    gesture: z.enum(['none', 'thumbs_up', 'thumbs_down']),
    code: z.object({ visible: z.boolean(), digits: z.string().nullable() }),
  }));
}

/** The text part of a request. It carries the products that the model must not name (R9). */
export function userText(exclude: readonly string[]): string {
  return `Exclude: ${exclude.length === 0 ? 'none' : exclude.join(', ')}.`;
}
