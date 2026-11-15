import type { GlanceBridge, NativeState } from '@glance/shared';
import { AndroidBridge, type NativeHost } from './androidBridge';
import { BrowserBridge } from './browserBridge';
import { NATIVE_NEW, NATIVE_PRESETS, NATIVE_READY, type NativePresetKey } from './fakeNative';

/** Reads the flag `api`. `/` gives an empty base, which is the origin of the page. No flag gives null. */
export function apiBaseOf(search: string): string | null {
  const api = new URLSearchParams(search).get('api');
  return api === null ? null : api.replace(/\/+$/, '');
}

function isPresetKey(key: string | null): key is NativePresetKey {
  return key !== null && Object.hasOwn(NATIVE_PRESETS, key);
}

/** Reads the start state of the browser bridge. The flag `native` names a preset, and it wins over the flag `ready`. */
function nativeStateOf(search: string): NativeState {
  const flags = new URLSearchParams(search);
  const key = flags.get('native');
  if (isPresetKey(key)) return NATIVE_PRESETS[key];
  return flags.get('ready') === '1' ? NATIVE_READY : NATIVE_NEW;
}

/** Returns the bridge of the WebView when the Android app is the host. If not, it returns the browser bridge. */
export function createBridge(host: NativeHost, search: string): GlanceBridge {
  if (host.GlanceNative) return new AndroidBridge(host);
  return new BrowserBridge({ apiBase: apiBaseOf(search), nativeState: nativeStateOf(search) });
}
