import { readFileSync } from 'node:fs';
import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { eventMessage } from '../debug/fixtures';
import { SessionScreen } from '../screens/SessionScreen';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';

const session = [eventMessage('glance.pending', { kind: 'new', warnings: [] }), eventMessage('cart.updated')];
const enter = async () => {
  const ui = renderWithUi(<SessionScreen />, { messages: session });
  await ui.user.click(screen.getByRole('button', { name: 'Pocket mode' }));
  return ui;
};
const ask = () => within(screen.getByRole('alertdialog', { name: 'Leave pocket mode?' }));

it('shows only the total on a black screen, and tells the app', async () => {
  const { bridge } = await enter();
  expect(bridge.sent).toContainEqual({ t: 'pocket.set', on: true });
  expect(screen.getByRole('heading', { level: 1, name: 'Pocket mode' })).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveClass('pocket-screen');
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  expect(screen.getByText('2 items')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
});
it('shows the new total when the cart changes in pocket mode', async () => {
  const { deliver } = await enter();
  deliver(eventMessage('cart.updated', { cart: { items: [], totalCents: 0 }, change: null }));
  expect(screen.getByText('0.00 EUR')).toBeInTheDocument();
  expect(screen.getByText('0 items')).toBeInTheDocument();
});
it('asks before it leaves pocket mode', async () => {
  const { bridge, user } = await enter();
  await user.click(screen.getByRole('button', { name: 'Unlock' }));
  await user.click(ask().getByRole('button', { name: 'Stay' }));
  expect(screen.getByRole('heading', { level: 1, name: 'Pocket mode' })).toBeInTheDocument();
  expect(bridge.sent).not.toContainEqual({ t: 'pocket.set', on: false });
  await user.click(screen.getByRole('button', { name: 'Unlock' }));
  await user.click(ask().getByRole('button', { name: 'Leave' }));
  expect(bridge.sent).toContainEqual({ t: 'pocket.set', on: false });
  expect(screen.getByRole('heading', { level: 1, name: 'Glance' })).toBeInTheDocument();
});
it('tells the app when the screen goes away with no tap', async () => {
  const { bridge, unmount } = await enter();
  unmount();
  expect(bridge.sent.at(-1)).toEqual({ t: 'pocket.set', on: false });
});
it('has no control below 48 px in pocket mode', async () => {
  await enter();
  expect(uncoveredTouchTargets(document.body)).toEqual([]);
});
it('paints the pocket screen black over the whole page', () => {
  expect(readFileSync('src/styles/pocket.css', 'utf8')).toMatch(/\.pocket-screen\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*background:\s*#000;/);
});
