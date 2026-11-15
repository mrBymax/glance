import type { Product, Profile, Warning } from '@glance/shared';

/**
 * What the shopper must hear about a product before a yes.
 * An empty list means "no known match". It does not mean that the product is safe.
 */
export function warningsFor(product: Product, profile: Profile): Warning[] {
  const warnings: Warning[] = [];
  let missing = false;

  if (profile.allergens.length > 0) {
    const listed = product.allergens;
    if (listed === null) {
      missing = true;
    } else {
      const allergens = profile.allergens.filter((allergen) => listed.includes(allergen));
      if (allergens.length > 0) warnings.push({ kind: 'allergen', allergens });
    }
  }

  let notVegan = false;
  if (profile.vegan) {
    if (product.vegan === null) missing = true;
    else if (!product.vegan) notVegan = true;
  }
  if (notVegan) {
    warnings.push({ kind: 'diet', diet: 'vegan' });
  } else if (profile.vegetarian) {
    // The contract has no warning for missing diet data, so the allergen one reports it.
    if (product.vegetarian === null) missing = true;
    else if (!product.vegetarian) warnings.push({ kind: 'diet', diet: 'vegetarian' });
  }

  if (missing) warnings.push({ kind: 'allergenDataMissing' });
  return warnings;
}
