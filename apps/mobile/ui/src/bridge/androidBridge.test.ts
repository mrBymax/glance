import { parseNativeToPage, type NativeToPage } from '@glance/shared';
import nativeStateJson from '@glance/shared/fixtures/bridge-native-to-page/native.state.json';
import { expect, it } from 'vitest';
import { AndroidBridge, type NativeHost } from './androidBridge';

const setup = () => {
  const posted: string[] = [];
  const host: NativeHost = { GlanceNative: { postMessage: (json) => posted.push(json) } };
  const bridge = new AndroidBridge(host);
  const seen: NativeToPage[] = [];
  const leave = bridge.subscribe((message) => seen.push(message));
  return { host, posted, bridge, seen, leave };
};

it('posts each message to the app as JSON', () => {
  const { bridge, posted } = setup();
  bridge.send({ t: 'intent', kind: 'yes', promptId: 'p-0001' });
  expect(posted.map((json) => JSON.parse(json))).toEqual([{ t: 'intent', kind: 'yes', promptId: 'p-0001' }]);
});
it('delivers a message of the app to the listener', () => {
  const { host, seen } = setup();
  host.__glanceReceive?.(JSON.stringify(nativeStateJson));
  expect(seen).toEqual([parseNativeToPage(nativeStateJson)]);
});
it('drops text that is not JSON and a message with an unknown t', () => {
  const { host, seen } = setup();
  expect(() => host.__glanceReceive?.('{not json')).not.toThrow();
  host.__glanceReceive?.(JSON.stringify({ t: 'future.message' }));
  expect(seen).toEqual([]);
});
it('stops delivery when the listener leaves', () => {
  const { host, seen, leave } = setup();
  leave();
  host.__glanceReceive?.(JSON.stringify(nativeStateJson));
  expect(seen).toEqual([]);
});
it('refuses a host that has no app object', () => {
  expect(() => new AndroidBridge({})).toThrow('window.GlanceNative is missing');
});
