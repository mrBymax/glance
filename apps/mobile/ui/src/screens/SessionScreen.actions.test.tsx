import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { BrowserBridge } from '../bridge/browserBridge';
import { eventFixture, eventMessage } from '../debug/fixtures';
import { renderWithUi } from '../test/render';
import { SessionScreen } from './SessionScreen';

const actions = (bridge: BrowserBridge) => bridge.sent.filter((message) => message.t !== 'ui.ready');

it('has a phone button for undo, repeat, and remove', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated'), eventMessage('caption')] });
  const item = eventFixture('cart.updated').cart.items[0]!;
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await user.click(screen.getByRole('button', { name: 'Repeat the last line' }));
  await user.click(screen.getByRole('button', { name: `Remove ${item.name}` }));
  expect(actions(bridge)).toEqual([
    { t: 'intent', kind: 'undo' },
    { t: 'intent', kind: 'repeat' },
    { t: 'cart.edit', productId: item.productId, qty: item.qty - 1 },
  ]);
});
it('hides undo and repeat when there is nothing to undo or to repeat', () => {
  renderWithUi(<SessionScreen />);
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Repeat the last line' })).toBeNull();
});
it('removes one unit of a line that holds three', async () => {
  const cart = eventFixture('cart.updated').cart;
  const lines = cart.items.map((item, index) => (index === 0 ? { ...item, qty: 3 } : item));
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [eventMessage('cart.updated', { cart: { ...cart, items: lines } })] });
  await user.click(screen.getByRole('button', { name: `Remove ${lines[0]!.name}` }));
  expect(actions(bridge)).toEqual([{ t: 'cart.edit', productId: lines[0]!.productId, qty: 2 }]);
});
it('asks before it ends the shop', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />);
  await user.click(screen.getByRole('button', { name: 'End' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'End this shop?' })).getByRole('button', { name: 'Keep shopping' }));
  expect(actions(bridge)).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'End' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'End this shop?' })).getByRole('button', { name: 'End' }));
  expect(actions(bridge)).toEqual([{ t: 'session.end' }]);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
