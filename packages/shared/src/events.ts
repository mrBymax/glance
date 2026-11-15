import { z } from 'zod';
import { AllergenSchema } from './allergens';
import { CartItemSchema, CartSchema } from './cart';
import { ProductRefSchema } from './catalog';
import { LangSchema } from './languages';
import { CentsSchema } from './money';

export const PhaseSchema = z.enum(['shopping', 'checkout', 'paid', 'resting', 'ended']);
export type Phase = z.infer<typeof PhaseSchema>;

export const AimHintSchema = z.enum(['none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn']);
export type AimHint = z.infer<typeof AimHintSchema>;

export const SoundNameSchema = z.enum(['found', 'added', 'removed', 'warning', 'paid']);
export type SoundName = z.infer<typeof SoundNameSchema>;

export const PrioritySchema = z.enum(['high', 'normal', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

export const KioskRefSchema = z.object({ id: z.string().min(1), name: z.string(), store: z.string() });
export type KioskRef = z.infer<typeof KioskRefSchema>;

export const WarningSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('allergen'), allergens: z.array(AllergenSchema) }),
  z.object({ kind: z.literal('diet'), diet: z.enum(['vegan', 'vegetarian']) }),
  z.object({ kind: z.literal('allergenDataMissing') }),
]);
export type Warning = z.infer<typeof WarningSchema>;

export const CaptionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  lang: LangSchema,
  priority: PrioritySchema,
  // The address of the speech clip, or null when no clip exists.
  url: z.string().nullable(),
});
export type Caption = z.infer<typeof CaptionSchema>;

export const ReceiptSchema = z.object({
  orderId: z.string().min(1),
  totalCents: CentsSchema,
  // ISO 8601 time.
  paidAt: z.string().min(1),
  items: z.array(CartItemSchema),
  kiosk: KioskRefSchema,
});
export type Receipt = z.infer<typeof ReceiptSchema>;

const promptId = z.string().min(1);

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.state'), phase: PhaseSchema, cameraOn: z.boolean() }),
  z.object({
    type: z.literal('glance.pending'),
    promptId,
    kind: z.enum(['new', 'inCart']),
    product: ProductRefSchema,
    warnings: z.array(WarningSchema),
    qtyInCart: z.number().int().min(0),
  }),
  z.object({ type: z.literal('glance.cleared'), promptId }),
  z.object({ type: z.literal('glance.hint'), aimHint: AimHintSchema }),
  z.object({ type: z.literal('glance.unknown') }),
  // For extra 3 of the spec. Section 8.3 of the spec does not list it.
  z.object({ type: z.literal('glance.ambiguous'), candidates: z.array(ProductRefSchema) }),
  z.object({
    type: z.literal('cart.updated'),
    cart: CartSchema,
    change: z.object({ kind: z.enum(['add', 'remove']), productId: z.string().min(1), name: z.string() }).nullable(),
  }),
  z.object({ type: z.literal('budget.exceeded'), budgetCents: CentsSchema, totalCents: CentsSchema }),
  z.object({
    type: z.literal('checkout.offered'),
    promptId,
    kiosk: KioskRefSchema,
    totalCents: CentsSchema,
    itemCount: z.number().int().min(0),
    needsBiometric: z.boolean(),
  }),
  z.object({ type: z.literal('checkout.suspended') }),
  z.object({ type: z.literal('checkout.spotcheck'), product: ProductRefSchema }),
  z.object({ type: z.literal('checkout.cancelled') }),
  ReceiptSchema.extend({ type: z.literal('checkout.paid') }),
  z.object({ type: z.literal('checkout.failed'), reason: z.string() }),
  CaptionSchema.extend({ type: z.literal('caption') }),
  z.object({ type: z.literal('error'), code: z.string().min(1), message: z.string() }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

/** Returns the event, or null for input that is no event of this version. It never throws. */
export function parseServerEvent(input: unknown): ServerEvent | null {
  const result = ServerEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
