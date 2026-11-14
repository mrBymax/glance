import type { CartItem, ProductRef } from '@glance/shared';

/**
 * Products of a barcode scan. The server gives each one the ID `gtin-<13 digits>`, and the name comes from Open Food Facts.
 * Each name has 80 characters. The second name starts with one word of 33 characters, which no line of 360 px holds.
 */
export const SCANNED: readonly ProductRef[] = [
  { id: 'gtin-3017624010701', name: "Crème fraîche épaisse d'Isigny AOP, entière, 30% de matière grasse, pot en verre", packSize: '50 cl', priceCents: 329 },
  { id: 'gtin-4006381333931', name: 'Schwarzwälderkirschtortenmischung mit Süßkirschen, glutenfrei, für die Großküche', packSize: '1,5 kg', priceCents: 1249 },
];

export const SCANNED_ITEMS: CartItem[] = SCANNED.map((product, index) => ({
  productId: product.id, name: product.name, packSize: product.packSize, qty: index + 1, unitPriceCents: product.priceCents,
}));

/** The total of SCANNED_ITEMS: 3.29 and two times 12.49. */
export const SCANNED_TOTAL_CENTS = 2827;
