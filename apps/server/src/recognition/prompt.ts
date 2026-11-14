import { z } from 'zod';
import { AimHintSchema, type Product } from '@glance/shared';
import { scannedProductId } from '../products/scanned';
import type { StoreEntry } from '../products/storeEntries';

const CATALOG_PLACEHOLDER = '{{catalog}}';
const STORE_ITEMS_PLACEHOLDER = '{{storeItems}}';

/**
 * The rules for a call that starts with reference pictures. A call with no picture does not get them,
 * so its instruction is the one of a server with no picture.
 */
const REFERENCE_RULES = `

## Reference pictures

The request starts with reference pictures: photos of the real package of some products, each after a line with the ID of its product. The last image is the frame.

- A reference picture can show the package from another side, at another size, or in other light. Its background means nothing.
- If a hand in the frame holds a product, and the shape, the colors, and the print of its package match the reference pictures of one product, use \`identified\` with that ID. This holds also when the text in the frame is too small to read.
- A package that is only similar to a reference picture gives \`unsure\`, or \`unknown\` when you can see that it is another product.
- Never answer about a product that only a reference picture shows. The status, the aim hint, and the code are about the frame alone.`;

/**
 * Puts the catalog and the store items into the instruction template, one line for each product.
 * A store item has the ID of a scanned product, and no look: the store list does not describe a package.
 * Its brand and pack size come from the store list, else from the details of the product database.
 * No line holds a price: the model names a product, and the price comes from the catalog or the store list.
 * `withReferences` adds the rules for reference pictures at the end.
 */
export function buildSystemInstruction(
  template: string, products: readonly Product[], storeEntries: readonly StoreEntry[], withReferences = false,
): string {
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
  const text = template
    .replace(CATALOG_PLACEHOLDER, () => (lines.length > 0 ? lines.join('\n') : '(The catalog is empty.)'))
    .replace(STORE_ITEMS_PLACEHOLDER, () => (storeLines.length > 0 ? storeLines.join('\n') : '(The store has no other items.)'));
  return withReferences ? text + REFERENCE_RULES : text;
}

/**
 * The JSON Schema of the answer: the six fields of spec section 11.1, and the code of the frame.
 * The product fields take only the given IDs, so the model cannot write an ID outside the catalog and the store list.
 * With no ID the answer can name no product: an enum with no value is no schema that the API takes.
 */
export function recognitionResponseSchema(productIds: readonly string[]): unknown {
  const id = productIds.length > 0 ? z.enum(productIds as [string, ...string[]]) : null;
  return z.toJSONSchema(z.object({
    status: z.enum(['identified', 'ambiguous', 'unsure', 'unknown', 'none']),
    productId: id === null ? z.null() : id.nullable(),
    candidates: id === null ? z.array(z.string()).max(0) : z.array(id),
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
