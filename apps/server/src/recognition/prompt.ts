import { z } from 'zod';
import { AimHintSchema, type Product } from '@glance/shared';

const CATALOG_PLACEHOLDER = '{{catalog}}';

/**
 * Puts the catalog into the instruction template, one line for each product.
 * The line holds no price: the model names a product, and the price comes from the catalog.
 */
export function buildSystemInstruction(template: string, products: readonly Product[]): string {
  if (!template.includes(CATALOG_PLACEHOLDER)) {
    throw new Error(`The recognition instruction has no ${CATALOG_PLACEHOLDER} placeholder.`);
  }
  const lines = products.map((product) => {
    const line = `- id: ${product.id} | name: ${product.name.en} | brand: ${product.brand} | pack: ${product.packSize} | look: ${product.visual}`;
    return product.lookAlikes.length > 0 ? `${line} | lookAlikes: ${product.lookAlikes.join(', ')}` : line;
  });
  // A function as the replacement keeps a "$" of a product text as it is.
  return template.replace(CATALOG_PLACEHOLDER, () => lines.join('\n'));
}

/**
 * The JSON Schema of the answer: the six fields of spec section 11.1, and the code of the frame.
 * The product fields take only the given IDs, so the model cannot write an ID outside the catalog.
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
