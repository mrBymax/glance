import type { NativeToPage } from '@glance/shared';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createBridge } from '../bridge/createBridge';
import { NATIVE_NEW, NATIVE_PRESETS, NATIVE_READY } from '../bridge/fakeNative';
import { eventMessage, SNAPSHOT } from '../debug/fixtures';
import { SessionScreen } from '../screens/SessionScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { StateBanner } from './StateBanner';
import { StatusRow } from './StatusRow';

it('shows the banner of the state, and its action', async () => {
  const { bridge, user } = renderWithUi(<StateBanner />, { native: NATIVE_PRESETS.updateRequired });
  expect(screen.getByText('Update required.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Open the update in Meta AI' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.openUpdate' });
});
it('shows no banner when all is well', () => {
  renderWithUi(<StateBanner />);
  expect(document.querySelector('.astryx-banner')).toBeNull();
});
it('removes an error of the app when the shopper tries again', async () => {
  const message = 'The link to Meta AI failed. Try again.';
  const failed = eventMessage('error', { code: 'native.registration_failed', message });
  const { user } = renderWithUi(<SetupScreen />, { native: NATIVE_NEW, messages: [failed] });
  expect(screen.getByText(message)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Link glasses' }));
  expect(screen.queryByText(message)).toBeNull();
});
it('starts the camera again from the banner of a stopped session', async () => {
  const snapshot: NativeToPage = { t: 'snapshot', session: { ...SNAPSHOT, phase: 'shopping', prompt: null } };
  const { bridge, user } = renderWithUi(<SessionScreen />, { native: NATIVE_PRESETS.stopped, messages: [snapshot] });
  expect(screen.getByText('Camera off.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start camera' }));
  expect(bridge.sent).toContainEqual({ t: 'session.start' });
});
it('leaves a session that has ended from its banner', async () => {
  const snapshot: NativeToPage = { t: 'snapshot', session: { ...SNAPSHOT, phase: 'ended', prompt: null } };
  const { user } = renderWithUi(<SessionScreen />, { messages: [snapshot] });
  await user.click(screen.getByRole('button', { name: 'Start a new shop' }));
  expect(document.querySelector('.astryx-banner')).toBeNull();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
it('pairs each device status with a word', () => {
  renderWithUi(<StatusRow />, { native: { ...NATIVE_PRESETS.paused, network: 'offline', device: null } });
  for (const text of ['Glasses: Not connected', 'Battery: Unknown', 'Camera: Paused', 'Network: Offline']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
});
it('shows the status of connected glasses', () => {
  renderWithUi(<StatusRow />, { native: { ...NATIVE_READY, stream: 'streaming' } });
  for (const text of ['Glasses: Connected', 'Battery: 80%', 'Camera: On', 'Network: Online']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
});
it('starts the browser bridge in the native state of the address', () => {
  const bridge = createBridge({}, '?native=glassesNotFound');
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'ui.ready' });
  expect(seen[0]).toEqual({ t: 'native.state', state: NATIVE_PRESETS.glassesNotFound });
});
it('ignores a native flag that names no state', () => {
  const bridge = createBridge({}, '?native=toString&ready=1');
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'ui.ready' });
  expect(seen[0]).toEqual({ t: 'native.state', state: NATIVE_READY });
});
it('has no control below 48 px in a banner with an action', () => {
  const { container } = renderWithUi(<StateBanner />, { native: NATIVE_PRESETS.updateRequired });
  expect(uncoveredTouchTargets(container)).toEqual([]);
});
