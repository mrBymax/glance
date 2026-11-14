import { z } from 'zod';

/** The 14 allergens of Annex II of Regulation (EU) No 1169/2011. */
export const EU_ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'] as const;
export type Allergen = (typeof EU_ALLERGENS)[number];
export const AllergenSchema = z.enum(EU_ALLERGENS);
