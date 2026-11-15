import { expect, it } from 'vitest';
import { NATIVE_PRESETS, NATIVE_READY } from '../bridge/fakeNative';
import { EN } from '../text/strings';
import { bannerOf } from './banner';
import { initialUiState, type UiState } from './uiState';

const base: UiState = { ...initialUiState, native: NATIVE_READY };
const shopping: UiState = { ...base, sessionId: 's-1', phase: 'shopping' };
const id = (state: UiState) => bannerOf(state, EN)?.id ?? null;
const line = (state: UiState) => {
  const banner = bannerOf(state, EN);
  return banner ? [banner.title, banner.description].filter(Boolean).join(' ') : null;
};

it('shows no banner when all is well', () => {
  expect(id(base)).toBeNull();
  expect(id(shopping)).toBeNull();
  expect(id({ ...initialUiState, native: null })).toBeNull();
});
it('shows only an error of the app before setup is done', () => {
  const offlineAtSetup: UiState = { ...shopping, native: { ...NATIVE_PRESETS.cameraDenied, network: 'offline' } };
  expect(id(offlineAtSetup)).toBeNull();
  expect(id({ ...shopping, native: NATIVE_PRESETS.notRegistered })).toBeNull();
  const denied = { code: 'native.bluetooth_denied', message: 'Allow Bluetooth to connect your glasses.' };
  expect(line({ ...initialUiState, native: NATIVE_PRESETS.notRegistered, error: denied })).toBe('Allow Bluetooth to connect your glasses.');
});
it.each([
  ['glassesNotFound', 'glassesNotFound'], ['updateRequired', 'updateRequired'], ['paused', 'paused'], ['stopped', 'stopped'],
  ['offFace', 'offFace'], ['battery20', 'batteryLow'], ['battery10', 'batteryLow'], ['tooWarm', 'regularCheckout'],
  ['batteryFlat', 'regularCheckout'], ['offline', 'serverUnreachable'],
] as const)('maps the native state %s to the banner %s', (preset, banner) => {
  expect(id({ ...shopping, native: NATIVE_PRESETS[preset] })).toBe(banner);
});
it('uses the spoken lines of the design', () => {
  expect(line({ ...shopping, native: NATIVE_PRESETS.paused })).toBe('Paused. Tap the side of your glasses to resume.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.stopped })).toBe('Camera off.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.offline })).toBe('Connection lost. Your cart is safe. Glances are paused.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.battery20 })).toBe('Glasses battery at 20 percent.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.tooWarm })).toContain('Camera off. Please use a regular checkout.');
  expect(line({ ...shopping, native: NATIVE_PRESETS.glassesNotFound })).toBe('Glasses not found. Unfold your glasses and keep them near the phone.');
  expect(line({ ...shopping, checkout: 'failed' })).toBe('Payment failed. Nothing was charged. Look at the code to try again.');
  expect(line({ ...shopping, error: { code: 'recognition.slow', message: 'Recognition is slow right now.' } })).toBe('Recognition is slow right now.');
});
it('adds the cause of the app to the stopped banner', () => {
  const error = { code: 'native.hinge_closed', message: 'Unfold your glasses to continue.' };
  expect(line({ ...shopping, native: NATIVE_PRESETS.stopped, error })).toBe('Camera off. Unfold your glasses to continue.');
});
it('shows one banner by priority', () => {
  expect(id({ ...shopping, checkout: 'failed', native: NATIVE_PRESETS.offline })).toBe('paymentFailed');
  expect(id({ ...shopping, native: { ...NATIVE_PRESETS.offline, device: null } })).toBe('serverUnreachable');
  expect(id({ ...shopping, phase: 'resting', native: NATIVE_PRESETS.stopped })).toBe('resting');
  expect(id({ ...shopping, phase: 'ended', native: NATIVE_PRESETS.stopped })).toBe('ended');
  expect(id({ ...shopping, phase: 'paid', native: NATIVE_PRESETS.stopped })).toBeNull();
  expect(id({ ...base, native: NATIVE_PRESETS.stopped })).toBeNull();
});
it('finds the glasses again only when the link is up', () => {
  const device = NATIVE_READY.device;
  if (!device) throw new Error('NATIVE_READY has no device');
  expect(id({ ...shopping, native: { ...NATIVE_READY, device: { ...device, link: 'disconnected' } } })).toBe('glassesNotFound');
});
it('keeps the numbers of the regular checkout at the limits of the server', () => {
  const device = NATIVE_PRESETS.stopped.device;
  if (!device) throw new Error('the stopped preset has no device');
  const stoppedWith = (change: Partial<typeof device>): UiState => ({ ...shopping, native: { ...NATIVE_PRESETS.stopped, device: { ...device, ...change } } });
  expect(id(stoppedWith({ battery: 5 }))).toBe('regularCheckout');
  expect(id(stoppedWith({ battery: 6 }))).toBe('stopped');
  expect(id(stoppedWith({ thermal: 5 }))).toBe('stopped');
  expect(id(stoppedWith({ battery: null, thermal: null }))).toBe('stopped');
});
it('offers the action that recovers', () => {
  expect(bannerOf({ ...shopping, native: NATIVE_PRESETS.updateRequired }, EN)?.action).toEqual({ label: 'Open the update in Meta AI', send: { t: 'setup.openUpdate' } });
  expect(bannerOf({ ...shopping, native: NATIVE_PRESETS.stopped }, EN)?.action).toEqual({ label: 'Start camera', send: { t: 'session.start' } });
  expect(bannerOf({ ...shopping, phase: 'resting' }, EN)?.action).toEqual({ label: 'Start camera', send: { t: 'session.start' } });
  expect(bannerOf({ ...shopping, phase: 'ended' }, EN)?.action).toEqual({ label: 'Start a new shop', dispatch: { t: 'local.reset' } });
});
