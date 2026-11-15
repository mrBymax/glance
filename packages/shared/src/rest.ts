import { z } from 'zod';
import { CartEditSchema, CartSchema } from './cart';
import { IntentKindSchema } from './device';
import { KioskRefSchema, ReceiptSchema } from './events';
import { KioskCodeSchema } from './kioskCode';
import { CentsSchema } from './money';
import { ProfilePatchSchema } from './profile';

// Bodies and answers of the REST calls of spec section 8.1, and the event of the kiosk page.

export const CreateSessionRequestSchema = z.object({ profile: ProfilePatchSchema.optional() });
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
  wsUrl: z.string().min(1),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const WebIntentRequestSchema = z.object({
  kind: IntentKindSchema,
  source: z.enum(['phone', 'hud']),
  promptId: z.string().min(1).optional(),
});
export type WebIntentRequest = z.infer<typeof WebIntentRequestSchema>;

export const CartEditRequestSchema = CartEditSchema;
export type CartEditRequest = z.infer<typeof CartEditRequestSchema>;

export const CreateKioskRequestSchema = z.object({
  name: z.string().min(1),
  store: z.string().min(1),
  spotCheck: z.boolean().optional(),
  failPayment: z.boolean().optional(),
});
export type CreateKioskRequest = z.infer<typeof CreateKioskRequestSchema>;

export const CreateKioskResponseSchema = z.object({
  kioskId: z.string().min(1),
  token: z.string().min(1),
  code: KioskCodeSchema,
});
export type CreateKioskResponse = z.infer<typeof CreateKioskResponseSchema>;

/** The answer of GET /api/demo/latest: the newest live session. */
export const LatestSessionResponseSchema = z.object({ sessionId: z.string().min(1), token: z.string().min(1) });
export type LatestSessionResponse = z.infer<typeof LatestSessionResponseSchema>;

export const KioskEventSchema = z.object({
  type: z.literal('kiosk.state'),
  state: z.enum(['idle', 'connected', 'spotcheck', 'paid', 'failed']),
  kiosk: KioskRefSchema,
  code: KioskCodeSchema,
  cart: CartSchema.nullable(),
  totalCents: CentsSchema.nullable(),
  receipt: ReceiptSchema.nullable(),
});
export type KioskEvent = z.infer<typeof KioskEventSchema>;
