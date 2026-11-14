import { screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { eventFixture, eventMessage, SNAPSHOT } from '../debug/fixtures';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { cartStatusLine } from '../text/format';
import { EN } from '../text/strings';
import { SessionScreen } from './SessionScreen';

const pending = (change = {}) => eventMessage('glance.pending', { kind: 'new', qtyInCart: 0, warnings: [], ...change });
const product = eventFixture('glance.pending').product;
const added = { kind: 'add', productId: 'oat-drink-1l', name: 'Oat drink' } as const;
const politeRegion = () => document.querySelector('[data-astryx-live-region="polite"]');

it('shows the idle hint and an empty cart before the first glance', () => {
  renderWithUi(<SessionScreen />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Glance' })).toBeInTheDocument();
  expect(screen.getByText('Hold a product up to hear its price.')).toBeInTheDocument();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
it('shows the product of the prompt with its pack size and price', () => {
  renderWithUi(<SessionScreen />, { messages: [pending()] });
  expect(screen.getByRole('heading', { level: 2, name: product.name })).toBeInTheDocument();
  expect(screen.getByText('1 L')).toBeInTheDocument();
  expect(screen.getByText('1.89 EUR')).toBeInTheDocument();
});
it('sends a yes and a no with the ID of the prompt on the card', async () => {
  const first = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await first.user.click(screen.getByRole('button', { name: 'Add' }));
  expect(first.bridge.sent).toContainEqual({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  first.unmount();
  const second = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await second.user.click(screen.getByRole('button', { name: 'Skip' }));
  expect(second.bridge.sent).toContainEqual({ t: 'intent', kind: 'no', promptId: 'p-0001' });
});
it('sends one answer for each prompt, also after two fast taps', async () => {
  const { bridge, user, deliver } = renderWithUi(<SessionScreen />, { messages: [pending()] });
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Skip' }));
  deliver(pending({ promptId: 'p-0002' }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(bridge.sent.filter((message) => message.t === 'intent')).toEqual([
    { t: 'intent', kind: 'yes', promptId: 'p-0001' },
    { t: 'intent', kind: 'yes', promptId: 'p-0002' },
  ]);
});
it('offers add another and remove one for a product that is in the cart', () => {
  renderWithUi(<SessionScreen />, { messages: [pending({ kind: 'inCart', qtyInCart: 1 })] });
  expect(screen.getByText('In your cart: 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add another' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove one' })).toBeInTheDocument();
});
it('shows a product name of 60 characters in full', () => {
  const name = 'Organic whole grain rye bread with seeds, sliced, family pack';
  renderWithUi(<SessionScreen />, { messages: [pending({ product: { ...product, name } })] });
  expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
});
it('shows each caption as text, with its language', () => {
  renderWithUi(<SessionScreen />, { messages: [
    eventMessage('caption', { id: 'c-a', text: 'Camera on.', lang: 'en' }),
    eventMessage('caption', { id: 'c-b', text: 'Aggiunto.', lang: 'it' }),
  ] });
  expect(screen.getByText('Camera on.')).toHaveAttribute('lang', 'en');
  expect(screen.getByText('Aggiunto.')).toHaveAttribute('lang', 'it');
});
it('shows the last 4 captions, the newest last', () => {
  const captions = Array.from({ length: 6 }, (_, n) => eventMessage('caption', { id: `c-${n}`, text: `Line ${n}.` }));
  renderWithUi(<SessionScreen />, { messages: captions });
  expect(screen.queryByText('Line 1.')).not.toBeInTheDocument();
  const shown = screen.getAllByText(/^Line \d\.$/).map((line) => line.textContent);
  expect(shown).toEqual(['Line 2.', 'Line 3.', 'Line 4.', 'Line 5.']);
});
it('shows the cart lines and the total of the server', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated')] });
  for (const item of eventFixture('cart.updated').cart.items) expect(screen.getByText(item.name)).toBeInTheDocument();
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
});
it('announces each caption in the polite live region', async () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('caption', { id: 'c-a', text: 'Skipped.' })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('Skipped.'));
  expect(document.querySelector('[data-astryx-live-region="assertive"]')?.textContent ?? '').toBe('');
});
it('announces each cart change in the polite live region', async () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated', { change: added })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent(cartStatusLine(eventFixture('cart.updated').cart, EN)));
});
it('does not announce the captions of a snapshot', async () => {
  const old = { id: 'c-old', text: 'An old line.', lang: 'en', priority: 'normal', url: null } as const;
  renderWithUi(<SessionScreen />, { messages: [{ t: 'snapshot', session: { ...SNAPSHOT, captions: [old] } }, eventMessage('caption', { id: 'c-new', text: 'A new line.' })] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('A new line.'));
  expect(politeRegion()).not.toHaveTextContent('An old line.');
});
it('does not announce the captions of a later snapshot of the same session', async () => {
  const missed = { id: 'c-missed', text: 'A line from the time with no connection.', lang: 'en', priority: 'normal', url: null } as const;
  renderWithUi(<SessionScreen />, { messages: [
    { t: 'snapshot', session: { ...SNAPSHOT, captions: [] } },
    { t: 'snapshot', session: { ...SNAPSHOT, captions: [missed] } },
    eventMessage('caption', { id: 'c-new', text: 'A new line.' }),
  ] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('A new line.'));
  expect(politeRegion()).not.toHaveTextContent(missed.text);
});
it('announces a caption again when an event changes its text after a snapshot', async () => {
  const old = { id: 'c-1', text: 'An old line.', lang: 'en', priority: 'normal', url: null } as const;
  renderWithUi(<SessionScreen />, { messages: [
    { t: 'snapshot', session: { ...SNAPSHOT, captions: [old] } },
    eventMessage('caption', { id: 'c-1', text: 'A changed line.' }),
  ] });
  await waitFor(() => expect(politeRegion()).toHaveTextContent('A changed line.'));
  expect(politeRegion()).not.toHaveTextContent('An old line.');
});
it('sends ui.ready one time, after it listens to the bridge', () => {
  const { bridge } = renderWithUi(<SessionScreen />);
  expect(bridge.sent).toEqual([{ t: 'ui.ready' }]);
});
it('has no control below 48 px on the session screen', () => {
  const { container } = renderWithUi(<SessionScreen />, { messages: [pending(), eventMessage('cart.updated')] });
  expect(uncoveredTouchTargets(container)).toEqual([]);
});
it('shows each warning on the card, and never says that a product is safe', () => {
  const { deliver } = renderWithUi(<SessionScreen />, { messages: [pending({ warnings: [{ kind: 'allergen', allergens: ['gluten'] }, { kind: 'diet', diet: 'vegan' }] })] });
  expect(screen.getByText('Warning: contains gluten.')).toBeInTheDocument();
  expect(screen.getByText('Warning: not vegan.')).toBeInTheDocument();
  deliver(pending({ promptId: 'p-0002', warnings: [] }));
  expect(screen.queryByText(/warning/i)).toBeNull();
  expect(screen.queryByText(/safe/i)).toBeNull();
});
it('says when allergen data is missing', () => {
  renderWithUi(<SessionScreen />, { messages: [pending({ warnings: [{ kind: 'allergenDataMissing' }] })] });
  expect(screen.getByText('Allergen data is missing for this product.')).toBeInTheDocument();
});
