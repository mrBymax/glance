import { DEFAULT_PROFILE } from '@glance/shared';
import { expect, it } from 'vitest';
import { NATIVE_PRESETS, NATIVE_READY } from '../bridge/fakeNative';
import { eventMessage } from '../debug/fixtures';
import { hapticFor } from './haptics';
import { initialUiState, reduce, type UiAction, type UiState } from './uiState';

const on: UiState = { ...initialUiState, native: NATIVE_READY };
const streaming: UiState = { ...on, native: { ...NATIVE_READY, session: 'started', stream: 'streaming' } };
const pattern = (action: UiAction, before: UiState = on) => hapticFor(before, action, reduce(before, action));
const change = (kind: 'add' | 'remove') => ({ kind, productId: 'oat-drink-1l', name: 'Oat drink' });

it('maps each event to the pattern of the design', () => {
  expect(pattern(eventMessage('glance.pending', { warnings: [] }))).toBe('prompt');
  expect(pattern(eventMessage('glance.pending', { warnings: [{ kind: 'allergenDataMissing' }] }))).toBe('warning');
  expect(pattern(eventMessage('checkout.offered'))).toBe('prompt');
  expect(pattern(eventMessage('cart.updated', { change: change('add') }))).toBe('added');
  expect(pattern(eventMessage('cart.updated', { change: change('remove') }))).toBe('removed');
  expect(pattern(eventMessage('cart.updated', { change: null }))).toBeNull();
  expect(pattern(eventMessage('budget.exceeded'))).toBe('warning');
  expect(pattern(eventMessage('checkout.paid'))).toBe('paid');
  expect(pattern(eventMessage('checkout.failed'))).toBe('error');
  expect(pattern(eventMessage('error'))).toBe('error');
  expect(pattern(eventMessage('caption'))).toBeNull();
});
it('signals a paused and a stopped camera one time', () => {
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.paused }, streaming)).toBe('cameraPaused');
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.paused }, { ...on, native: NATIVE_PRESETS.paused })).toBeNull();
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, streaming)).toBe('cameraOff');
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, { ...on, native: NATIVE_PRESETS.paused })).toBe('cameraOff');
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, { ...on, native: NATIVE_PRESETS.stopped })).toBeNull();
});
it('gives no pattern for the first native state, a snapshot, and a local action', () => {
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.stopped }, initialUiState)).toBeNull();
  expect(pattern({ t: 'native.state', state: NATIVE_PRESETS.paused }, initialUiState)).toBeNull();
  expect(pattern({ t: 'local.reset' }, streaming)).toBeNull();
});
it('stays silent when haptics are off', () => {
  expect(pattern(eventMessage('checkout.paid'), { ...on, profile: { ...DEFAULT_PROFILE, haptics: false } })).toBeNull();
});
it('the add that crosses the budget gives one pattern: the warning of budget.exceeded, and no pattern for its cart.updated', () => {
  const items = [{ productId: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', qty: 1, unitPriceCents: 189 }];
  const withBudget: UiState = { ...on, profile: { ...DEFAULT_PROFILE, budgetCents: 300 }, cart: { items, totalCents: 189 } };
  const crossing = eventMessage('cart.updated', { cart: { items: [{ ...items[0]!, qty: 2 }], totalCents: 378 }, change: change('add') });
  expect(pattern(crossing, withBudget)).toBeNull();
  expect(pattern(eventMessage('budget.exceeded'), reduce(withBudget, crossing))).toBe('warning');
  // An add under the budget, an add when the total is already over it, and a removal keep their patterns.
  const under = eventMessage('cart.updated', { cart: { items, totalCents: 250 }, change: change('add') });
  expect(pattern(under, withBudget)).toBe('added');
  expect(pattern(crossing, { ...withBudget, cart: { items, totalCents: 301 } })).toBe('added');
  const removal = eventMessage('cart.updated', { cart: { items: [], totalCents: 0 }, change: change('remove') });
  expect(pattern(removal, { ...withBudget, cart: { items, totalCents: 378 } })).toBe('removed');
});
