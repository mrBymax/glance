import type { GlanceBridge } from '@glance/shared';
import { AndroidBridge, type NativeHost } from './androidBridge';
import { BrowserBridge } from './browserBridge';
import { NATIVE_NEW, NATIVE_READY } from './fakeNative';

/** Reads the flag `api`. `/` gives an empty base, which is the origin of the page. No flag gives null. */
export function apiBaseOf(search: string): string | null {
  const api = new URLSearchParams(search).get('api');
  return api === null ? null : api.replace(/\/+$/, '');
}

/** Returns the bridge of the WebView when the Android app is the host. If not, it returns the browser bridge. */
export function createBridge(host: NativeHost, search: string): GlanceBridge {
  if (host.GlanceNative) return new AndroidBridge(host);
  const ready = new URLSearchParams(search).get('ready') === '1';
  return new BrowserBridge({ apiBase: apiBaseOf(search), nativeState: ready ? NATIVE_READY : NATIVE_NEW });
}
