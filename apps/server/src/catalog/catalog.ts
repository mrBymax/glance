import { readFileSync } from 'node:fs';
import { type Product, ProductSchema } from '@glance/shared';

export type CatalogIndex = { readonly products: readonly Product[]; get(id: string): Product | undefined };

/** Throws on a duplicate ID. */
export function indexCatalog(products: readonly Product[]): CatalogIndex {
  const byId = new Map<string, Product>();
  for (const product of products) {
    if (byId.has(product.id)) throw new Error(`The catalog holds the ID "${product.id}" two times.`);
    byId.set(product.id, product);
  }
  return { products: [...products], get: (id) => byId.get(id) };
}

/** Reads a JSON array of products. Throws an error that names the file and the entry that fails. */
export function readCatalogFile(path: string): Product[] {
  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the catalog file ${path}: ${(error as Error).message}`, { cause: error });
  }
  if (!Array.isArray(entries)) throw new Error(`The catalog file ${path} must hold a JSON array of products.`);

  return entries.map((entry: unknown, index) => {
    const parsed = ProductSchema.safeParse(entry);
    if (parsed.success) return parsed.data;
    const id = (entry as { id?: unknown } | null)?.id;
    const label = typeof id === 'string' ? ` (${id})` : '';
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'entry'}: ${issue.message}`).join(', ');
    throw new Error(`The catalog file ${path} has a bad entry ${index}${label}. ${issues}`);
  });
}
