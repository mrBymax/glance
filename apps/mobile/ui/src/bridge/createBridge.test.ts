import type { NativeToPage } from '@glance/shared';
import { expect, it } from 'vitest';
import { fakeFetch, fakeSources } from '../test/fakes';
import { AndroidBridge } from './androidBridge';
import { BrowserBridge } from './browserBridge';
import { apiBaseOf, createBridge } from './createBridge';
import { NATIVE_READY } from './fakeNative';

it('uses the app bridge inside the WebView', () => {
  expect(createBridge({ GlanceNative: { postMessage() {} } }, '')).toBeInstanceOf(AndroidBridge);
});
it('uses the browser bridge elsewhere, and reads the ready flag', () => {
  const bridge = createBridge({}, '?ready=1');
  expect(bridge).toBeInstanceOf(BrowserBridge);
  const seen: NativeToPage[] = [];
  bridge.subscribe((message) => seen.push(message));
  bridge.send({ t: 'ui.ready' });
  expect(seen[0]).toEqual({ t: 'native.state', state: NATIVE_READY });
});
it('reads the server address from the api flag', () => {
  expect(apiBaseOf('')).toBeNull();
  expect(apiBaseOf('?api=/')).toBe('');
  expect(apiBaseOf('?api=http://127.0.0.1:8080/')).toBe('http://127.0.0.1:8080');
});
it('makes no network call without the api flag', () => {
  const http = fakeFetch(() => ({}));
  const sources = fakeSources();
  const bridge = new BrowserBridge({ apiBase: apiBaseOf('?ready=1'), fetch: http.fetch, createEventSource: sources.create });
  bridge.send({ t: 'session.start' });
  bridge.send({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  bridge.send({ t: 'data.delete' });
  expect(http.calls).toEqual([]);
  expect(sources.sources).toEqual([]);
});
