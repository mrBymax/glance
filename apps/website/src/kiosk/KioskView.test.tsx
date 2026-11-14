import { parseServerEvent, type KioskEvent } from '@glance/shared';
import cartUpdated from '@glance/shared/fixtures/events/cart.updated.json';
import checkoutPaid from '@glance/shared/fixtures/events/checkout.paid.json';
import fixture from '@glance/shared/fixtures/rest/KioskEvent.json';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { eur } from '../lib/format';
import { renderWithTheme } from '../test/render';
import { SCANNED_ITEMS, SCANNED_TOTAL_CENTS } from '../test/scanned';
import { parseKioskEvent } from './kioskModel';
import { KioskView } from './KioskView';

function parsed<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('a fixture of @glance/shared did not parse');
  return value;
}

const base = parsed(parseKioskEvent(fixture));
const cartEvent = parsed(parseServerEvent(cartUpdated));
const paidEvent = parsed(parseServerEvent(checkoutPaid));
if (cartEvent.type !== 'cart.updated' || paidEvent.type !== 'checkout.paid') throw new Error('a fixture has the wrong event type');
const cart = cartEvent.cart;
const { type, ...receipt } = paidEvent;

const at = (state: KioskEvent['state'], more: Partial<KioskEvent> = {}): KioskEvent =>
  ({ ...base, state, cart: null, totalCents: null, receipt: null, ...more });
const code = () => screen.getByRole('img', { name: `Checkout code ${base.code}` });

it.each([
  ['idle', 'Look at this code to pay'],
  ['connected', 'Waiting for your nod'],
  ['spotcheck', 'Quick check'],
  ['paid', 'Paid'],
  ['failed', 'Payment failed. Nothing was charged.'],
] as const)('names the state %s in the main heading and keeps the code', (state, heading) => {
  renderWithTheme(<KioskView event={at(state)} link="open" />);
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(code()).toBeInTheDocument();
});
it('keeps the code black on white, with its quiet zone', () => {
  renderWithTheme(<KioskView event={at('idle')} link="open" />);
  expect(code()).toHaveAttribute('viewBox', '0 0 29 29');
  expect(code().querySelector('rect')).toHaveAttribute('fill', '#fff');
  expect(code().querySelector('path')).toHaveAttribute('fill', '#000');
});
it('keeps the code as the first child of the page in each state', () => {
  for (const state of ['idle', 'connected', 'paid', 'failed'] as const) {
    const { unmount } = renderWithTheme(<KioskView event={at(state)} link="open" />);
    expect(screen.getByRole('main').firstElementChild).toBe(code());
    unmount();
  }
});
it('shows the kiosk, the store, and a line for a shopper with no glasses', () => {
  renderWithTheme(<KioskView event={at('idle')} link="open" />);
  expect(screen.getByText(`${base.kiosk.name}, ${base.kiosk.store}`)).toBeInTheDocument();
  expect(screen.getByText('No glasses? Use a staffed checkout.')).toBeInTheDocument();
});
it('shows a kiosk name of 200 characters in full', () => {
  const name = 'Checkout '.repeat(22).trim();
  renderWithTheme(<KioskView event={at('idle', { kiosk: { ...base.kiosk, name } })} link="open" />);
  expect(screen.getByText(`${name}, ${base.kiosk.store}`)).toBeInTheDocument();
});
it('shows the total of the server and each cart line', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: cart.totalCents })} link="open" />);
  expect(screen.getByText('4.49 EUR')).toHaveClass('kiosk-total');
  for (const item of cart.items) expect(screen.getByText(item.name)).toHaveClass('kiosk-row');
  expect(screen.getByText('1 x 1.89 EUR')).toHaveClass('kiosk-row');
});
it('shows the total of the event, and never a sum of the lines', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: 123456 })} link="open" />);
  expect(screen.getByText('1234.56 EUR')).toHaveClass('kiosk-total');
  expect(screen.queryByText('4.49 EUR')).not.toBeInTheDocument();
});
it('counts the cart lines that do not fit', () => {
  const items = Array.from({ length: 9 }, (_, n) => ({ ...cart.items[0]!, productId: `p-${n}`, name: `Product ${n}` }));
  renderWithTheme(<KioskView event={at('connected', { cart: { items, totalCents: 900 }, totalCents: 900 })} link="open" />);
  expect(screen.getByText('and 2 more items')).toBeInTheDocument();
  expect(screen.getByText('Product 6')).toBeInTheDocument();
  expect(screen.queryByText('Product 7')).not.toBeInTheDocument();
});
it('shows the paid amount, the receipt lines, and the demo line', () => {
  renderWithTheme(<KioskView event={at('paid', { receipt, totalCents: receipt.totalCents })} link="open" />);
  expect(screen.getByText(eur(receipt.totalCents))).toHaveClass('kiosk-total');
  for (const item of receipt.items) expect(screen.getByText(item.name)).toBeInTheDocument();
  expect(screen.getByText('Demo payment. No money moved.')).toBeInTheDocument();
});
it('shows scanned products with names of 80 characters and accents, in the cart and on the receipt', () => {
  const scanned = { items: SCANNED_ITEMS, totalCents: SCANNED_TOTAL_CENTS };
  const cartView = renderWithTheme(<KioskView event={at('connected', { cart: scanned, totalCents: SCANNED_TOTAL_CENTS })} link="open" />);
  for (const item of SCANNED_ITEMS) {
    expect(item.name).toHaveLength(80);
    expect(screen.getByText(item.name)).toHaveClass('kiosk-row', 'kiosk-name');
  }
  expect(screen.getByText('2 x 12.49 EUR')).toHaveClass('kiosk-row');
  expect(screen.getByText('28.27 EUR')).toHaveClass('kiosk-total');
  expect(screen.getByRole('main').firstElementChild).toBe(code());
  cartView.unmount();
  renderWithTheme(<KioskView event={at('paid', { receipt: { ...receipt, ...scanned }, totalCents: SCANNED_TOTAL_CENTS })} link="open" />);
  for (const item of SCANNED_ITEMS) expect(screen.getByText(item.name)).toHaveClass('kiosk-name');
  expect(screen.getByText('28.27 EUR')).toHaveClass('kiosk-total');
});
it('says how to try again after a failed payment', () => {
  renderWithTheme(<KioskView event={at('failed')} link="open" />);
  expect(screen.getByText('Look at the code to try again.')).toBeInTheDocument();
});
it('keeps the code, and says so, while the connection is lost', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: cart.totalCents })} link="lost" />);
  expect(screen.getByText('Connection lost. Reconnecting.')).toBeInTheDocument();
  expect(code()).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
});
it('says that it connects before a code exists', () => {
  renderWithTheme(<KioskView event={null} link="registering" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Connecting to the store' })).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('says that the server does not answer before a code exists', () => {
  renderWithTheme(<KioskView event={null} link="unreachable" />);
  expect(screen.getByRole('heading', { level: 1, name: 'The store server does not answer' })).toBeInTheDocument();
  expect(screen.getByText('The page tries again every 3 seconds.')).toBeInTheDocument();
});
it('names a spot check, and keeps the code and the cart', () => {
  renderWithTheme(<KioskView event={at('spotcheck', { cart, totalCents: cart.totalCents })} link="open" />);
  expect(screen.getByRole('heading', { level: 1, name: 'Quick check' })).toBeInTheDocument();
  expect(screen.getByText('Show the product that the voice names to your glasses.')).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  expect(code()).toBeInTheDocument();
});
it('shows no spot check line while the shopper only pays', () => {
  renderWithTheme(<KioskView event={at('connected', { cart, totalCents: cart.totalCents })} link="open" />);
  expect(screen.queryByText('Show the product that the voice names to your glasses.')).toBeNull();
});
it('shows fewer cart lines during a spot check, because its line takes the room of two', () => {
  const items = Array.from({ length: 9 }, (_, n) => ({ ...cart.items[0]!, productId: `p-${n}`, name: `Product ${n}` }));
  renderWithTheme(<KioskView event={at('spotcheck', { cart: { items, totalCents: 900 }, totalCents: 900 })} link="open" />);
  expect(screen.getByText('Product 4')).toBeInTheDocument();
  expect(screen.queryByText('Product 5')).toBeNull();
  expect(screen.getByText('and 4 more items')).toBeInTheDocument();
});
