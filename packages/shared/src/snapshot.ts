import { z } from 'zod';
import { CartSchema } from './cart';
import { ProductRefSchema } from './catalog';
import { CaptionSchema, KioskRefSchema, PhaseSchema, ReceiptSchema, WarningSchema } from './events';
import { CentsSchema } from './money';
import { ProfileSchema } from './profile';

export const CurrentPromptSchema = z.discriminatedUnion('kind', [
  z.object({
    promptId: z.string().min(1),
    kind: z.literal('product'),
    mode: z.enum(['new', 'inCart']),
    product: ProductRefSchema,
    warnings: z.array(WarningSchema),
    qtyInCart: z.number().int().min(0),
  }),
  z.object({
    promptId: z.string().min(1),
    kind: z.literal('pay'),
    kiosk: KioskRefSchema,
    totalCents: CentsSchema,
    itemCount: z.number().int().min(0),
    needsBiometric: z.boolean(),
  }),
]);
export type CurrentPrompt = z.infer<typeof CurrentPromptSchema>;

export const SessionSnapshotSchema = z.object({
  sessionId: z.string().min(1),
  phase: PhaseSchema,
  cameraOn: z.boolean(),
  prompt: CurrentPromptSchema.nullable(),
  cart: CartSchema,
  profile: ProfileSchema,
  kiosk: KioskRefSchema.nullable(),
  lastReceipt: ReceiptSchema.nullable(),
  // The last 20, oldest first.
  captions: z.array(CaptionSchema).max(20),
});
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;
