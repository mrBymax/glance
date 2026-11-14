import { parseNativeToPage, type NativeToPage } from '@glance/shared';
import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AndroidBridge, type NativeHost } from '../bridge/androidBridge';
import { eventMessage } from '../debug/fixtures';
import { renderWithUi } from '../test/render';
import { SCANNED, SCANNED_ITEMS, SCANNED_TOTAL_CENTS } from '../test/scanned';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { SessionScreen } from './SessionScreen';

const cart = { items: SCANNED_ITEMS, totalCents: SCANNED_TOTAL_CENTS };
const cartMessage = eventMessage('cart.updated', { cart, change: null });
const paidMessage = eventMessage('checkout.paid', { items: SCANNED_ITEMS, totalCents: SCANNED_TOTAL_CENTS });
const pending = (product: (typeof SCANNED)[number]) =>
  eventMessage('glance.pending', { kind: 'new', qtyInCart: 0, warnings: [{ kind: 'allergenDataMissing' }], product });

it('uses names of 80 characters with accents, and the ID form of a scanned product', () => {
  for (const product of SCANNED) {
    expect(product.name).toHaveLength(80);
    expect(product.name).toMatch(/[èéäüß]/);
    expect(product.id).toMatch(/^gtin-\d{13}$/);
  }
});
it.each(SCANNED)('shows the card of the scanned product $id with its full name, pack size, and price', async (product) => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [pending(product)] });
  expect(screen.getByRole('heading', { level: 2, name: product.name })).toBeInTheDocument();
  expect(screen.getByText(product.packSize)).toBeInTheDocument();
  expect(screen.getByText(product.priceCents === 329 ? '3.29 EUR' : '12.49 EUR')).toBeInTheDocument();
  expect(screen.getByText('Allergen data is missing for this product.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(bridge.sent).toContainEqual({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
});
it('shows each scanned product in the cart, and removes one unit by its ID', async () => {
  const { bridge, user, container } = renderWithUi(<SessionScreen />, { messages: [cartMessage] });
  for (const item of SCANNED_ITEMS) expect(screen.getByText(item.name)).toBeInTheDocument();
  expect(screen.getByText('50 cl, 1 x 3.29 EUR')).toBeInTheDocument();
  expect(screen.getByText('1,5 kg, 2 x 12.49 EUR')).toBeInTheDocument();
  expect(screen.getByText('28.27 EUR')).toBeInTheDocument();
  expect(uncoveredTouchTargets(container)).toEqual([]);
  await user.click(screen.getByRole('button', { name: `Remove ${SCANNED_ITEMS[1]!.name}` }));
  expect(bridge.sent).toContainEqual({ t: 'cart.edit', productId: 'gtin-4006381333931', qty: 1 });
});
it('keeps the cart of scanned products under the checkout sheet, and shows the total of the pay prompt', () => {
  renderWithUi(<SessionScreen />, { messages: [cartMessage, eventMessage('checkout.offered', { totalCents: SCANNED_TOTAL_CENTS, itemCount: 3 })] });
  const sheet = within(screen.getByRole('dialog', { name: 'Checkout' }));
  expect(sheet.getByText('3 items')).toBeInTheDocument();
  expect(sheet.getByText('28.27 EUR')).toBeInTheDocument();
});
it('shows each scanned product on the receipt', () => {
  renderWithUi(<SessionScreen />, { messages: [cartMessage, eventMessage('checkout.offered'), paidMessage] });
  const sheet = within(screen.getByRole('dialog', { name: 'Receipt' }));
  for (const item of SCANNED_ITEMS) expect(sheet.getByText(item.name)).toBeInTheDocument();
  expect(sheet.getByText('50 cl, 1 x 3.29 EUR')).toBeInTheDocument();
  expect(sheet.getByText('1,5 kg, 2 x 12.49 EUR')).toBeInTheDocument();
  expect(sheet.getByText('28.27 EUR')).toBeInTheDocument();
});
it('takes a scanned product from the app, with each accent of the name', () => {
  const host: NativeHost = { GlanceNative: { postMessage: () => undefined } };
  const seen: NativeToPage[] = [];
  new AndroidBridge(host).subscribe((message) => seen.push(message));
  const message = pending(SCANNED[0]!);
  host.__glanceReceive?.(JSON.stringify(message));
  expect(seen).toEqual([parseNativeToPage(message)]);
  expect(seen).toHaveLength(1);
});
