import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { NATIVE_NEW, NATIVE_READY } from '../bridge/fakeNative';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { EN } from '../text/strings';
import { META_AI_STORE_URL, SetupScreen } from './SetupScreen';

it('shows four steps and marks the current one', () => {
  renderWithUi(<SetupScreen />, { native: NATIVE_NEW });
  const steps = within(screen.getByRole('list', { name: 'Setup' })).getAllByRole('listitem');
  expect(steps).toHaveLength(4);
  expect(steps[0]).toHaveAttribute('aria-current', 'step');
  expect(steps.map((step) => step.textContent)).toEqual([
    expect.stringContaining('Link glasses'), expect.stringContaining('Allow camera'), expect.stringContaining('Allow notifications'), expect.stringContaining('Ready'),
  ]);
});
it('says what opens, what to confirm, and how to return, then links the glasses', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: NATIVE_NEW });
  for (const text of ['This opens the Meta AI app.', 'Confirm there that Glance may connect to your glasses.', 'Meta AI then returns you to Glance.']) {
    expect(screen.getByText(text)).toBeInTheDocument();
  }
  await user.click(screen.getByRole('button', { name: 'Link glasses' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.register' });
  expect(await screen.findByRole('button', { name: 'Allow camera' })).toBeInTheDocument();
});
it('explains the purpose of the camera before it asks', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, registration: 'registered' } });
  expect(screen.getByText(EN.cameraWhy)).toBeInTheDocument();
  expect(screen.getByText('Choose Allow always or Allow once.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Allow camera' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.requestCamera' });
});
it('explains a denied camera permission and asks again', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_READY, cameraPermission: 'denied' } });
  expect(screen.getByText(EN.cameraDenied)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Allow camera' })).toBeInTheDocument();
});
it('says what the notification is for, then asks for the permission', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_READY, notificationPermission: 'unknown' } });
  expect(screen.getByRole('heading', { level: 2, name: 'Allow notifications' })).toBeInTheDocument();
  expect(screen.getByText(EN.notificationsWhy)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start shopping' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Allow notifications' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.requestNotifications' });
  expect(await screen.findByRole('button', { name: 'Start shopping' })).toBeInTheDocument();
});
it('starts with denied notifications, says what is missing, and offers the permission again', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_READY, notificationPermission: 'denied' } });
  expect(screen.getByText(EN.notificationsDenied)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start shopping' }));
  expect(bridge.sent).toContainEqual({ t: 'session.start' });
  await user.click(screen.getByRole('button', { name: 'Allow notifications' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.requestNotifications' });
});
it('offers no notification button on the ready step when the permission is granted', () => {
  renderWithUi(<SetupScreen />);
  expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
});
it('offers the store when the Meta AI app is missing', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, metaAiInstalled: false, registration: 'unavailable' } });
  expect(screen.getByRole('link', { name: 'Get Meta AI' })).toHaveAttribute('href', META_AI_STORE_URL);
  expect(screen.queryByRole('button', { name: 'Link glasses' })).toBeNull();
});
it('offers a new try with no internet', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, network: 'offline' } });
  expect(screen.getByText(EN.noInternet)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(bridge.sent).toContainEqual({ t: 'setup.register' });
});
it('waits with no button while Meta AI is open', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_NEW, registration: 'registering' } });
  expect(screen.getByText(EN.linking)).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
});
it('starts the session from the ready step', async () => {
  const { bridge, user } = renderWithUi(<SetupScreen />);
  await user.click(screen.getByRole('button', { name: 'Start shopping' }));
  expect(bridge.sent).toContainEqual({ t: 'session.start' });
});
it('has no control below 48 px on each setup step', () => {
  const notifications = (notificationPermission: 'unknown' | 'denied') => ({ ...NATIVE_READY, notificationPermission });
  const states = [
    NATIVE_NEW, { ...NATIVE_NEW, metaAiInstalled: false }, { ...NATIVE_NEW, registration: 'registered' as const },
    notifications('unknown'), notifications('denied'), NATIVE_READY,
  ];
  for (const native of states) {
    const { container, unmount } = renderWithUi(<SetupScreen />, { native });
    expect(uncoveredTouchTargets(container)).toEqual([]);
    unmount();
  }
});
it('shows the text and the button of the step below the list, where they have the full width', () => {
  renderWithUi(<SetupScreen />);
  const list = screen.getByRole('list', { name: 'Setup' });
  expect(screen.getByRole('heading', { level: 2, name: 'Ready' })).toBeInTheDocument();
  expect(list).not.toContainElement(screen.getByRole('button', { name: 'Start shopping' }));
  expect(list).not.toContainElement(screen.getByText(EN.readyText));
});
it('numbers the taps of the jump to Meta AI in their order', () => {
  renderWithUi(<SetupScreen />, { native: NATIVE_NEW });
  const taps = screen.getAllByRole('list').find((list) => list.tagName === 'OL' && list.getAttribute('aria-label') === null);
  expect(within(taps as HTMLElement).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'This opens the Meta AI app.', 'Confirm there that Glance may connect to your glasses.', 'Meta AI then returns you to Glance.',
  ]);
});
it('puts the cause of a denied permission before the purpose and the taps', () => {
  renderWithUi(<SetupScreen />, { native: { ...NATIVE_READY, cameraPermission: 'denied' } });
  const denied = screen.getByText(EN.cameraDenied);
  const purpose = screen.getByText(EN.cameraWhy);
  expect(denied.compareDocumentPosition(purpose) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(purpose.compareDocumentPosition(screen.getByText(EN.cameraOpens)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
