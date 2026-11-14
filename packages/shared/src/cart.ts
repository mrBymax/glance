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

const NO_ITEMS: CartItem[] = [];
Object.freeze(NO_ITEMS);

/**
 * The cart of a new session. Each app shares this one object, so it is frozen.
 * A change to it would show in each session, and each test that compares with it would pass by mistake.
 * To change a cart, make a new one.
 */
export const EMPTY_CART: Cart = Object.freeze({ items: NO_ITEMS, totalCents: 0 });
