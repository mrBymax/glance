import type { NativeState } from '@glance/shared';
import type { UiState } from './uiState';

export type Screen = 'loading' | 'setup' | 'session';

/** Returns 0 while the glasses are not linked, 1 while the camera is not allowed, and 2 when setup is done. */
export function setupStepOf(native: NativeState): 0 | 1 | 2 {
  if (native.registration !== 'registered') return 0;
  return native.cameraPermission === 'granted' ? 2 : 1;
}

export function screenOf(state: UiState): Screen {
  if (!state.native) return 'loading';
  return setupStepOf(state.native) === 2 && state.sessionId !== null ? 'session' : 'setup';
}
