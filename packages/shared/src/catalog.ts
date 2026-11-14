import { z } from 'zod';
import { AllergenSchema } from './allergens';
import { type Lang, LocalizedSchema, localize } from './languages';
import { CentsSchema } from './money';

export const ProductSchema = z.object({
  // Lower case with hyphens, for example "oat-drink-1l".
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  gtin: z.string().min(1).optional(),
  name: LocalizedSchema,
  spokenName: LocalizedSchema,
  brand: z.string().min(1),
  // Shown on screen, for example "1 L".
  packSize: z.string().min(1),
  spokenPack: LocalizedSchema,
  spokenPackDetailed: LocalizedSchema,
  priceCents: CentsSchema,
  // null means "no data". An empty list means "no allergen".
  allergens: z.array(AllergenSchema).nullable(),
  vegan: z.boolean().nullable(),
  vegetarian: z.boolean().nullable(),
  // The look of the package, for the recognition prompt.
  visual: z.string().min(1),
  // IDs of products with a similar package.
  lookAlikes: z.array(z.string()).default(() => []),
});
export type Product = z.infer<typeof ProductSchema>;

export const ProductRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  packSize: z.string().min(1),
  priceCents: CentsSchema,
});
export type ProductRef = z.infer<typeof ProductRefSchema>;

export function toProductRef(product: Product, lang: Lang): ProductRef {
  return {
    id: product.id,
    name: localize(product.name, lang),
    packSize: product.packSize,
    priceCents: product.priceCents,
  };
}
