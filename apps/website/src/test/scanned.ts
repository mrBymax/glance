import type { CartItem } from '@glance/shared';

/**
 * Cart lines of a barcode scan. The server gives each product the ID `gtin-<13 digits>`, and the name comes from Open Food Facts.
 * Each name has 80 characters. The second name starts with one word of 33 characters.
 */
export const SCANNED_ITEMS: CartItem[] = [
  { productId: 'gtin-3017624010701', name: "Crème fraîche épaisse d'Isigny AOP, entière, 30% de matière grasse, pot en verre", packSize: '50 cl', qty: 1, unitPriceCents: 329 },
  { productId: 'gtin-4006381333931', name: 'Schwarzwälderkirschtortenmischung mit Süßkirschen, glutenfrei, für die Großküche', packSize: '1,5 kg', qty: 2, unitPriceCents: 1249 },
];

/** The total of SCANNED_ITEMS: 3.29 and two times 12.49. */
export const SCANNED_TOTAL_CENTS = 2827;
