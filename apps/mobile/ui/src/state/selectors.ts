import type { NativeState } from '@glance/shared';
import type { UiState } from './uiState';

export type Screen = 'loading' | 'setup' | 'session';

export type SetupStep = 0 | 1 | 2 | 3;

/**
 * Returns 0 while the glasses are not linked, 1 while the camera is not allowed, 2 before the app asked for
 * notifications, and 3 when setup is done. A denied notification permission does not stop a shop, so it gives 3.
 */
export function setupStepOf(native: NativeState): SetupStep {
  if (native.registration !== 'registered') return 0;
  if (native.cameraPermission !== 'granted') return 1;
  return native.notificationPermission === 'unknown' ? 2 : 3;
}

export function screenOf(state: UiState): Screen {
  if (!state.native) return 'loading';
  // A shop that runs needs the glasses and the camera only. So a notification step that is still open does not hide it.
  return setupStepOf(state.native) >= 2 && state.sessionId !== null ? 'session' : 'setup';
}
