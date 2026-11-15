import type { NativeState } from '@glance/shared';
import { expect, it } from 'vitest';
import { NATIVE_NEW, NATIVE_READY } from '../bridge/fakeNative';
import { screenOf, setupStepOf } from './selectors';
import { initialUiState, type UiState } from './uiState';

const at = (native: NativeState | null, sessionId: string | null = null): UiState => ({ ...initialUiState, native, sessionId });

it('picks the setup step from the native state', () => {
  expect(setupStepOf(NATIVE_NEW)).toBe(0);
  expect(setupStepOf({ ...NATIVE_NEW, registration: 'registered' })).toBe(1);
  expect(setupStepOf({ ...NATIVE_READY, cameraPermission: 'denied' })).toBe(1);
  expect(setupStepOf({ ...NATIVE_READY, notificationPermission: 'unknown' })).toBe(2);
  expect(setupStepOf({ ...NATIVE_READY, notificationPermission: 'denied' })).toBe(3);
  expect(setupStepOf(NATIVE_READY)).toBe(3);
});
it('picks the screen', () => {
  expect(screenOf(at(null))).toBe('loading');
  expect(screenOf(at(NATIVE_NEW))).toBe('setup');
  expect(screenOf(at(NATIVE_READY))).toBe('setup');
  expect(screenOf(at(NATIVE_READY, 's-1'))).toBe('session');
  expect(screenOf(at(NATIVE_NEW, 's-1'))).toBe('setup');
  expect(screenOf(at({ ...NATIVE_READY, notificationPermission: 'unknown' }, 's-1'))).toBe('session');
  expect(screenOf(at({ ...NATIVE_READY, notificationPermission: 'unknown' }))).toBe('setup');
});
