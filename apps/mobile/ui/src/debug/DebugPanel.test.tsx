import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NATIVE_PRESETS } from '../bridge/fakeNative';
import { SessionScreen } from '../screens/SessionScreen';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { DebugPanel } from './DebugPanel';
import { EVENT_TYPES, eventFixture } from './fixtures';

const open = async () => {
  const ui = renderWithUi(<><SessionScreen /><DebugPanel /></>);
  await ui.user.click(screen.getByRole('button', { name: 'Debug' }));
  return { ...ui, panel: within(screen.getByRole('dialog', { name: 'Debug' })) };
};

it('sends an event fixture into the page', async () => {
  const { user, panel } = await open();
  await user.click(panel.getByRole('button', { name: 'glance.pending' }));
  expect(screen.getByRole('heading', { level: 2, name: eventFixture('glance.pending').product.name })).toBeInTheDocument();
});
it('has one button for each event type and each native state', async () => {
  const { panel } = await open();
  expect(EVENT_TYPES).toHaveLength(16);
  for (const name of [...EVENT_TYPES, ...Object.keys(NATIVE_PRESETS)]) expect(panel.getByRole('button', { name })).toBeInTheDocument();
});
it('switches the native state', async () => {
  const { user, panel } = await open();
  await user.click(panel.getByRole('button', { name: 'glassesNotFound' }));
  expect(screen.getByText('Glasses not found.')).toBeInTheDocument();
});
it('stays open after a tap, and resets the page', async () => {
  const { user, panel } = await open();
  await user.click(panel.getByRole('button', { name: 'cart.updated' }));
  expect(screen.getByText('4.49 EUR')).toBeInTheDocument();
  await user.click(panel.getByRole('button', { name: 'Reset' }));
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Debug' })).toBeInTheDocument();
});
it('lists the messages that the page sent', async () => {
  const { panel } = await open();
  expect(panel.getByText('{"t":"ui.ready"}')).toBeInTheDocument();
  expect(panel.queryByText(/^Session query:/)).toBeNull();
});
it('has no control below 48 px', async () => {
  await open();
  expect(uncoveredTouchTargets(document.body)).toEqual([]);
});
