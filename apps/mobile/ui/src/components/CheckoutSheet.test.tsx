import { fireEvent, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { BrowserBridge } from '../bridge/browserBridge';
import { eventFixture, eventMessage } from '../debug/fixtures';
import { SessionScreen } from '../screens/SessionScreen';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { eur } from '../text/format';

const offered = eventFixture('checkout.offered');
const offer = eventMessage('checkout.offered', { needsBiometric: false });
const sheet = (name: string) => within(screen.getByRole('dialog', { name }));
const intents = (bridge: BrowserBridge) => bridge.sent.filter((message) => message.t === 'intent');

it('names the kiosk, the store, and the total before the payment', () => {
  renderWithUi(<SessionScreen />, { messages: [offer] });
  expect(sheet('Checkout').getByText('Checkout 3 at Demo Market')).toBeInTheDocument();
  expect(sheet('Checkout').getByText('2 items')).toBeInTheDocument();
  expect(sheet('Checkout').getByText(eur(offered.totalCents))).toBeInTheDocument();
});
it('pays one time with the ID of the pay prompt, also after two fast taps', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [offer] });
  const pay = sheet('Checkout').getByRole('button', { name: 'Pay' });
  await user.click(pay);
  await user.click(pay);
  await user.click(sheet('Checkout').getByRole('button', { name: 'Cancel' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
});
it('cancels with the ID of the pay prompt', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [offer] });
  await user.click(sheet('Checkout').getByRole('button', { name: 'Cancel' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'no', promptId: 'p-0001' }]);
  expect(screen.queryByRole('dialog', { name: 'Checkout' })).toBeNull();
});
it('cancels when the shopper dismisses the sheet', () => {
  const { bridge } = renderWithUi(<SessionScreen />, { messages: [offer] });
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Checkout' }), { key: 'Escape' });
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'no', promptId: 'p-0001' }]);
});
it('sends no cancel when the shopper dismisses the sheet after Pay', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [offer] });
  await user.click(sheet('Checkout').getByRole('button', { name: 'Pay' }));
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Checkout' }), { key: 'Escape' });
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
  expect(screen.getByRole('dialog', { name: 'Checkout' })).toBeInTheDocument();
});
it('takes a new pay prompt after a cart change', async () => {
  const { bridge, user, deliver } = renderWithUi(<SessionScreen />, { messages: [offer] });
  deliver(eventMessage('checkout.offered', { promptId: 'p-0002', totalCents: 260, itemCount: 1 }));
  expect(sheet('Checkout').getByText('2.60 EUR')).toBeInTheDocument();
  await user.click(sheet('Checkout').getByRole('button', { name: 'Pay' }));
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0002' }]);
});
it('opens again for a new pay prompt after a cancel', async () => {
  const { bridge, user, deliver } = renderWithUi(<SessionScreen />, { messages: [offer] });
  await user.click(sheet('Checkout').getByRole('button', { name: 'Cancel' }));
  deliver(eventMessage('checkout.cancelled'), eventMessage('checkout.offered', { promptId: 'p-0002' }));
  await user.click(sheet('Checkout').getByRole('button', { name: 'Pay' }));
  expect(intents(bridge)).toEqual([
    { t: 'intent', kind: 'no', promptId: 'p-0001' },
    { t: 'intent', kind: 'yes', promptId: 'p-0002' },
  ]);
});
it('shows an error of the app inside the sheet', () => {
  const message = 'Set a screen lock or a fingerprint on this phone first.';
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('error', { code: 'native.biometric_unavailable', message })] });
  expect(sheet('Checkout').getByText(message)).toBeInTheDocument();
});
it('closes while checkout is suspended', () => {
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('checkout.suspended')] });
  expect(screen.queryByRole('dialog', { name: 'Checkout' })).toBeNull();
});
it('shows the receipt with the demo line after the payment', () => {
  const paid = eventFixture('checkout.paid');
  renderWithUi(<SessionScreen />, { messages: [offer, eventMessage('checkout.paid')] });
  expect(sheet('Receipt').getByRole('heading', { name: 'Paid' })).toBeInTheDocument();
  expect(sheet('Receipt').getByText(eur(paid.totalCents))).toBeInTheDocument();
  for (const item of paid.items) expect(sheet('Receipt').getByText(item.name)).toBeInTheDocument();
  expect(sheet('Receipt').getByText('Checkout 3 at Demo Market')).toBeInTheDocument();
  expect(sheet('Receipt').getByText('Order ord-0001')).toBeInTheDocument();
  expect(sheet('Receipt').getByText('Demo payment. No money moved.')).toBeInTheDocument();
});
it('clears the session after Done', async () => {
  const { user } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated'), offer, eventMessage('checkout.paid')] });
  await user.click(sheet('Receipt').getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
it('has no control below 48 px in the pay view and in the receipt', () => {
  const { baseElement, deliver } = renderWithUi(<SessionScreen />, { messages: [offer] });
  expect(uncoveredTouchTargets(baseElement)).toEqual([]);
  deliver(eventMessage('checkout.paid'));
  expect(uncoveredTouchTargets(baseElement)).toEqual([]);
});
it('asks for the fingerprint when the server requires it', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('checkout.offered', { needsBiometric: true })] });
  expect(sheet('Checkout').getByText('Over fifty euros. Confirm with your fingerprint on the phone.')).toBeInTheDocument();
  expect(sheet('Checkout').getByRole('button', { name: 'Pay with fingerprint' })).toBeInTheDocument();
  expect(sheet('Checkout').queryByRole('button', { name: 'Pay' })).toBeNull();
});
it('shows no fingerprint line for a payment that needs none', () => {
  renderWithUi(<SessionScreen />, { messages: [offer] });
  expect(sheet('Checkout').queryByText(/fingerprint/)).toBeNull();
});
it('pays one time with the fingerprint button, and has no control below 48 px', async () => {
  const { bridge, user, baseElement } = renderWithUi(<SessionScreen />, { messages: [eventMessage('checkout.offered', { needsBiometric: true })] });
  expect(uncoveredTouchTargets(baseElement)).toEqual([]);
  const pay = sheet('Checkout').getByRole('button', { name: 'Pay with fingerprint' });
  await user.click(pay);
  await user.click(pay);
  expect(intents(bridge)).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
});
it('shows the short word Pay on the fingerprint button, so that a large font does not cut it', () => {
  renderWithUi(<SessionScreen />, { messages: [eventMessage('checkout.offered', { needsBiometric: true })] });
  expect(sheet('Checkout').getByRole('button', { name: 'Pay with fingerprint' })).toHaveTextContent(/^Pay$/);
});
