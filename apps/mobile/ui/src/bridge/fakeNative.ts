import type { NativeState } from '@glance/shared';

/** Nothing linked yet. */
export const NATIVE_NEW: NativeState = {
  metaAiInstalled: true,
  registration: 'available',
  cameraPermission: 'unknown',
  device: null,
  session: 'idle',
  stream: 'stopped',
  network: 'online',
  capabilities: { motion: true, inputs: true, speech: true },
  mock: true,
};

/** Linked, camera allowed, glasses connected. */
export const NATIVE_READY: NativeState = {
  ...NATIVE_NEW,
  registration: 'registered',
  cameraPermission: 'granted',
  device: { name: 'Mock glasses', link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, updateRequired: false },
};
