import type { NativeState } from '@glance/shared';

type Device = NonNullable<NativeState['device']>;

const MOCK_GLASSES: Device = {
  name: 'Mock glasses', link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, updateRequired: false,
};

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
  device: MOCK_GLASSES,
};

export type NativePresetKey = 'ready' | 'metaAiMissing' | 'notRegistered' | 'cameraDenied' | 'glassesNotFound' | 'updateRequired'
  | 'paused' | 'stopped' | 'offFace' | 'battery20' | 'battery10' | 'tooWarm' | 'batteryFlat' | 'offline';

const withDevice = (change: Partial<Device>): NativeState => ({ ...NATIVE_READY, device: { ...MOCK_GLASSES, ...change } });
const STOPPED: NativeState = { ...NATIVE_READY, session: 'stopped', stream: 'stopped' };

/** One native state for each device and error state of the design, section 6.6. The flag `native` and the tests use them. */
export const NATIVE_PRESETS: Record<NativePresetKey, NativeState> = {
  ready: NATIVE_READY,
  metaAiMissing: { ...NATIVE_NEW, metaAiInstalled: false, registration: 'unavailable' },
  notRegistered: NATIVE_NEW,
  cameraDenied: { ...NATIVE_READY, cameraPermission: 'denied' },
  glassesNotFound: { ...NATIVE_READY, device: null },
  updateRequired: withDevice({ updateRequired: true }),
  paused: { ...NATIVE_READY, session: 'paused', stream: 'paused' },
  stopped: STOPPED,
  offFace: withDevice({ worn: false }),
  battery20: withDevice({ battery: 20 }),
  battery10: withDevice({ battery: 10 }),
  tooWarm: { ...STOPPED, device: { ...MOCK_GLASSES, thermal: 6 } },
  batteryFlat: { ...STOPPED, device: { ...MOCK_GLASSES, battery: 3 } },
  offline: { ...NATIVE_READY, network: 'offline' },
};
