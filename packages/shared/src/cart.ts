import { z } from 'zod';
import { CentsSchema } from './money';

export const CartItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  packSize: z.string().min(1),
  qty: z.number().int().positive(),
  unitPriceCents: CentsSchema,
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  items: z.array(CartItemSchema),
  totalCents: CentsSchema,
});
export type Cart = z.infer<typeof CartSchema>;

/** A cart edit sets the quantity of one line. The quantity 0 removes the line. */
export const CartEditSchema = z.object({ productId: z.string().min(1), qty: z.number().int().min(0) });

export const EMPTY_CART: Cart = { items: [], totalCents: 0 };
