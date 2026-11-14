import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDeviceToServer, parseServerToDevice } from './device';

function expectEachFixture(folder: string, count: number, parse: (input: unknown) => { t: string } | null) {
  const dir = new URL(`../fixtures/${folder}/`, import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  expect(files.length).toBe(count);
  for (const file of files) {
    const message = parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    expect(message?.t).toBe(file.replace(/\.json$/, ''));
  }
}

describe('device messages', () => {
  it('parses each fixture in device-to-server (8 files) and server-to-device (6 files)', () => {
    expectEachFixture('device-to-server', 8, parseDeviceToServer);
    expectEachFixture('server-to-device', 6, parseServerToDevice);
  });
  it('accepts a yes without a prompt ID', () => {
    expect(parseDeviceToServer({ t: 'intent', kind: 'yes', source: 'phone' })).not.toBeNull();
  });
  it('rejects an unknown intent kind and an unknown message', () => {
    expect(parseDeviceToServer({ t: 'intent', kind: 'maybe', source: 'head' })).toBeNull();
    expect(parseDeviceToServer({ t: 'launch.rocket' })).toBeNull();
  });
  it('accepts a line with no clip', () => {
    const speak = { t: 'speak', id: 's-1', priority: 'normal', text: 'Skipped.', lang: 'en', url: null,
      sound: null, interrupt: false, promptId: null };
    expect(parseServerToDevice(speak)).toEqual(speak);
  });
});
