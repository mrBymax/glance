import { DEFAULT_PROFILE } from '@glance/shared';
import { Theme } from '@astryxdesign/core/theme';
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { AndroidBridge } from '../bridge/androidBridge';
import { BridgeProvider } from '../bridge/BridgeContext';
import type { BrowserBridge } from '../bridge/browserBridge';
import { eventMessage } from '../debug/fixtures';
import { SessionScreen } from '../screens/SessionScreen';
import { renderWithUi } from '../test/render';
import { uncoveredTouchTargets } from '../test/touchTargets';
import { OPEN_FOOD_FACTS_URL, SettingsSheet } from './SettingsSheet';

const open = async (options?: Parameters<typeof renderWithUi>[1]) => {
  const ui = renderWithUi(<SessionScreen />, options);
  await ui.user.click(screen.getByRole('button', { name: 'Settings' }));
  return { ...ui, sheet: within(screen.getByRole('dialog', { name: 'Settings' })) };
};
const patches = (bridge: BrowserBridge) => bridge.sent.flatMap((message) => (message.t === 'profile.set' ? [message.patch] : []));

it('sends each preference as a profile patch', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('radio', { name: 'Brief' }));
  await user.click(sheet.getByRole('radio', { name: '1.5x' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Head gestures' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Haptics' }));
  await user.click(sheet.getByRole('radio', { name: 'Shake is yes' }));
  await user.click(sheet.getByRole('radio', { name: 'While in view' }));
  await user.click(sheet.getByRole('radio', { name: 'Voice' }));
  expect(patches(bridge)).toEqual([
    { detail: 'brief' }, { speechRate: 1.5 }, { headGestures: false }, { haptics: false }, { yesGesture: 'shake' },
    { headWindowMs: null }, { mainYes: 'voice' },
  ]);
});
it('sends the head window as a number of milliseconds, and a checkbox in both directions', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('radio', { name: '15 seconds' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Haptics' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Haptics' }));
  expect(patches(bridge)).toEqual([{ headWindowMs: 15000 }, { haptics: false }, { haptics: true }]);
});
it('shows a new value at once', async () => {
  const { user, sheet } = await open();
  await user.click(sheet.getByRole('radio', { name: 'Brief' }));
  expect(sheet.getByRole('radio', { name: 'Brief' })).toHaveAttribute('aria-checked', 'true');
});
it('marks the nearest speed for a rate that is not in the list', async () => {
  const { sheet } = await open({ messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, speechRate: 1.3 } }] });
  expect(sheet.getByRole('radio', { name: '1.2x' })).toHaveAttribute('aria-checked', 'true');
});
it('plays a sample line', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('button', { name: 'Play sample' }));
  expect(bridge.sent).toContainEqual({ t: 'intent', kind: 'help' });
});
it('states what Glance stores', async () => {
  const { sheet } = await open();
  expect(sheet.getByRole('heading', { level: 2, name: 'Privacy' })).toBeInTheDocument();
  expect(sheet.getByText(/never stores it/)).toBeInTheDocument();
});
it('names the source of the product data, with a link to it', async () => {
  const { sheet } = await open();
  expect(OPEN_FOOD_FACTS_URL).toBe('https://openfoodfacts.org');
  expect(sheet.getByText('Product data: Open Food Facts (ODbL)')).toBeInTheDocument();
  const link = sheet.getByRole('link', { name: 'Open website of Open Food Facts' });
  expect(link).toHaveAttribute('href', OPEN_FOOD_FACTS_URL);
  expect(link).toHaveTextContent(/^Open website$/);
});
it('names the source of the product data in Italian', async () => {
  const { user } = renderWithUi(<SessionScreen />, { messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, lang: 'it' } }] });
  await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
  const sheet = within(screen.getByRole('dialog', { name: 'Impostazioni' }));
  expect(sheet.getByText('Dati dei prodotti: Open Food Facts (ODbL)')).toBeInTheDocument();
  const link = sheet.getByRole('link', { name: 'Apri il sito di Open Food Facts' });
  expect(link).toHaveAttribute('href', OPEN_FOOD_FACTS_URL);
  expect(link).toHaveTextContent(/^Apri il sito$/);
});
it('opens the source in a new tab of a browser, so that the session stays', async () => {
  const { sheet } = await open();
  const link = sheet.getByRole('link', { name: 'Open website of Open Food Facts' });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
it('gives the link no target in the WebView, where the app opens it outside', () => {
  const bridge = new AndroidBridge({ GlanceNative: { postMessage: () => undefined } });
  render(
    <Theme theme={themes[defaultThemeSlug]}>
      <BridgeProvider bridge={bridge}><SettingsSheet isOpen onClose={() => undefined} /></BridgeProvider>
    </Theme>,
  );
  const link = screen.getByRole('link', { name: 'Open website of Open Food Facts' });
  expect(link).toHaveAttribute('href', OPEN_FOOD_FACTS_URL);
  expect(link).not.toHaveAttribute('target');
});
it('asks before it deletes the data', async () => {
  const { bridge, user, sheet } = await open({ messages: [eventMessage('cart.updated')] });
  await user.click(sheet.getByRole('button', { name: 'Delete my data' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'Delete my data?' })).getByRole('button', { name: 'Keep' }));
  expect(bridge.sent).not.toContainEqual({ t: 'data.delete' });
  await user.click(sheet.getByRole('button', { name: 'Delete my data' }));
  await user.click(within(screen.getByRole('alertdialog', { name: 'Delete my data?' })).getByRole('button', { name: 'Delete' }));
  expect(bridge.sent).toContainEqual({ t: 'data.delete' });
  expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
});
it('has no control below 48 px in the settings sheet', async () => {
  const { baseElement } = await open();
  expect(uncoveredTouchTargets(baseElement)).toEqual([]);
});
it('lists the 14 EU allergens and two diets, and sends each change', async () => {
  const { bridge, user, sheet } = await open();
  const allergens = within(sheet.getByRole('group', { name: 'Allergens' }));
  expect(allergens.getAllByRole('checkbox')).toHaveLength(14);
  await user.click(allergens.getByRole('checkbox', { name: 'Gluten' }));
  await user.click(allergens.getByRole('checkbox', { name: 'Milk' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Vegan' }));
  expect(patches(bridge)).toEqual([{ allergens: ['gluten'] }, { allergens: ['gluten', 'milk'] }, { vegan: true }]);
});
it('keeps the allergens in the order of the EU list, and removes one', async () => {
  const { bridge, user, sheet } = await open();
  await user.click(sheet.getByRole('checkbox', { name: 'Milk' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Gluten' }));
  expect(sheet.getByRole('checkbox', { name: 'Milk' })).toBeChecked();
  await user.click(sheet.getByRole('checkbox', { name: 'Milk' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Vegetarian' }));
  await user.click(sheet.getByRole('checkbox', { name: 'Vegetarian' }));
  expect(patches(bridge)).toEqual([
    { allergens: ['milk'] }, { allergens: ['gluten', 'milk'] }, { allergens: ['gluten'] }, { vegetarian: true }, { vegetarian: false },
  ]);
});
it('sends the budget in cents, and null when the shopper clears it', async () => {
  const { bridge, user, sheet } = await open();
  await user.type(sheet.getByRole('spinbutton', { name: 'Budget' }), '20');
  await user.tab();
  await user.click(sheet.getByRole('button', { name: 'Clear Budget' }));
  expect(patches(bridge)).toEqual([{ budgetCents: 2000 }, { budgetCents: null }]);
});
it('shows the budget of the profile in euros', async () => {
  const { sheet } = await open({ messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, budgetCents: 3500 } }] });
  expect(sheet.getByRole('spinbutton', { name: 'Budget' })).toHaveValue('35');
});
it('sends the language, and shows the page in Italian', async () => {
  const { bridge, user, sheet } = await open({ messages: [eventMessage('glance.pending', { kind: 'new', warnings: [] })] });
  await user.click(sheet.getByRole('radio', { name: 'Italiano' }));
  expect(patches(bridge)).toEqual([{ lang: 'it' }]);
  expect(document.documentElement).toHaveAttribute('lang', 'it');
  expect(screen.getByRole('dialog', { name: 'Impostazioni' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salta' })).toBeInTheDocument();
});
it('marks the language of the profile, and returns to English', async () => {
  const { bridge, user } = renderWithUi(<SessionScreen />, { messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, lang: 'it' } }] });
  await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
  const italian = within(screen.getByRole('dialog', { name: 'Impostazioni' }));
  expect(italian.getByRole('radio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'true');
  await user.click(italian.getByRole('radio', { name: 'English' }));
  expect(patches(bridge)).toEqual([{ lang: 'en' }]);
  expect(document.documentElement).toHaveAttribute('lang', 'en');
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
});
it('has no control below 48 px in the Italian settings sheet', async () => {
  const { baseElement, user } = renderWithUi(<SessionScreen />, { messages: [{ t: 'profile', profile: { ...DEFAULT_PROFILE, lang: 'it' } }] });
  await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
  expect(uncoveredTouchTargets(baseElement)).toEqual([]);
});
