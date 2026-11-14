import type { NativeToPage } from '@glance/shared';
import { screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from './App';
import { NATIVE_NEW, NATIVE_PRESETS } from './bridge/fakeNative';
import { eventMessage, SNAPSHOT } from './debug/fixtures';
import { renderWithUi } from './test/render';
import { uncoveredTouchTargets } from './test/touchTargets';

const session: NativeToPage[] = [
  { t: 'snapshot', session: { ...SNAPSHOT, phase: 'shopping', prompt: null, lastReceipt: null } },
  eventMessage('glance.pending', { kind: 'new', warnings: [] }),
  eventMessage('caption'),
  eventMessage('cart.updated'),
];
const tap = async (ui: ReturnType<typeof renderWithUi>, name: string) => ui.user.click(screen.getByRole('button', { name }));

const SCENES: [string, () => Promise<unknown>][] = [
  ['setup, link step', async () => renderWithUi(<App />, { native: NATIVE_NEW })],
  ['setup, camera step', async () => renderWithUi(<App />, { native: { ...NATIVE_NEW, registration: 'registered' } })],
  ['setup, notification step', async () => renderWithUi(<App />, { native: NATIVE_PRESETS.notificationsNotAsked })],
  ['setup, ready step', async () => renderWithUi(<App />)],
  ['setup, ready step with denied notifications', async () => renderWithUi(<App />, { native: NATIVE_PRESETS.notificationsDenied })],
  ['setup, no Meta AI app', async () => renderWithUi(<App />, { native: NATIVE_PRESETS.metaAiMissing })],
  ['session', async () => renderWithUi(<App />, { messages: session })],
  ['checkout', async () => renderWithUi(<App />, { messages: [...session, eventMessage('checkout.offered')] })],
  ['receipt', async () => renderWithUi(<App />, { messages: [...session, eventMessage('checkout.paid')] })],
  ['settings', async () => tap(renderWithUi(<App />, { messages: session }), 'Settings')],
  ['end dialog', async () => tap(renderWithUi(<App />, { messages: session }), 'End')],
  ['banner with an action', async () => renderWithUi(<App />, { native: NATIVE_PRESETS.updateRequired, messages: session })],
  ['debug panel', async () => tap(renderWithUi(<App />, { messages: session }), 'Debug')],
];

it.each(SCENES)('%s: one main landmark, one main heading, one named logo, named controls, covered touch targets', async (_name, open) => {
  await open();
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole('img', { name: 'Meta Glance' })).toHaveLength(1);
  const controls = ['button', 'link', 'radio', 'checkbox', 'spinbutton'].flatMap((role) => screen.queryAllByRole(role));
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) expect(control).toHaveAccessibleName();
  expect(uncoveredTouchTargets(document.body)).toEqual([]);
  expect(document.querySelector('.astryx-status-dot, .astryx-switch, [role="slider"]')).toBeNull();
});
it('never uses the assertive live region', async () => {
  renderWithUi(<App />, { native: NATIVE_PRESETS.offline, messages: [...session, eventMessage('error'), eventMessage('checkout.failed')] });
  await waitFor(() => expect(document.querySelector('[data-astryx-live-region="polite"]')).not.toBeNull());
  expect(document.querySelector('[data-astryx-live-region="assertive"]')?.textContent ?? '').toBe('');
});
