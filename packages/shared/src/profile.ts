import { z } from 'zod';
import { AllergenSchema } from './allergens';
import { LangSchema } from './languages';

const fields = {
  lang: LangSchema,
  detail: z.enum(['brief', 'standard', 'detailed']),
  speechRate: z.number().min(0.8).max(2),
  speakPrices: z.boolean(),
  headGestures: z.boolean(),
  yesGesture: z.enum(['nod', 'shake']),
  // null means "while in view".
  headWindowMs: z.union([z.literal(8000), z.literal(15000), z.null()]),
  haptics: z.boolean(),
  mainYes: z.enum(['head', 'touch', 'voice', 'phone', 'key']),
  allergens: z.array(AllergenSchema),
  vegan: z.boolean(),
  vegetarian: z.boolean(),
  // A positive number of cents, or null for no budget.
  budgetCents: z.number().int().positive().nullable(),
};

export const ProfileSchema = z.object({
  lang: fields.lang.default('en'),
  detail: fields.detail.default('standard'),
  speechRate: fields.speechRate.default(1),
  speakPrices: fields.speakPrices.default(true),
  headGestures: fields.headGestures.default(true),
  yesGesture: fields.yesGesture.default('nod'),
  headWindowMs: fields.headWindowMs.default(8000),
  haptics: fields.haptics.default(true),
  mainYes: fields.mainYes.default('head'),
  allergens: fields.allergens.default(() => []),
  vegan: fields.vegan.default(false),
  vegetarian: fields.vegetarian.default(false),
  budgetCents: fields.budgetCents.default(null),
});
export type Profile = z.infer<typeof ProfileSchema>;

// Built from the fields with no defaults: a patch holds only the keys that the sender set.
export const ProfilePatchSchema = z.object(fields).partial();
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const DEFAULT_PROFILE: Profile = ProfileSchema.parse({});
