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
  it('parses each fixture in device-to-server (9 files) and server-to-device (7 files)', () => {
    expectEachFixture('device-to-server', 9, parseDeviceToServer);
    expectEachFixture('server-to-device', 7, parseServerToDevice);
  });
  it('accepts a yes without a prompt ID', () => {
    expect(parseDeviceToServer({ t: 'intent', kind: 'yes', source: 'phone' })).not.toBeNull();
  });
  it('rejects an unknown intent kind and an unknown message', () => {
    expect(parseDeviceToServer({ t: 'intent', kind: 'maybe', source: 'head' })).toBeNull();
    expect(parseDeviceToServer({ t: 'launch.rocket' })).toBeNull();
  });
  it('accepts a barcode report with a code of 8 to 14 digits from the decoder or from OCR', () => {
    const seen = { t: 'barcode.seen', code: '8076809513753', source: 'barcode' };
    expect(parseDeviceToServer(seen)).toEqual(seen);
    expect(parseDeviceToServer({ ...seen, code: '73513537', source: 'ocr' })).not.toBeNull();
    expect(parseDeviceToServer({ ...seen, code: '00012345600012' })).not.toBeNull();
  });
  it('rejects a barcode report with another length, other characters, or another source', () => {
    for (const code of ['1234567', '123456789012345', '8 076809 513753', '807680951375X', '']) {
      expect(parseDeviceToServer({ t: 'barcode.seen', code, source: 'barcode' }), code).toBeNull();
    }
    expect(parseDeviceToServer({ t: 'barcode.seen', code: '8076809513753', source: 'label' })).toBeNull();
    expect(parseDeviceToServer({ t: 'barcode.seen', code: '8076809513753' })).toBeNull();
  });
  it('accepts a request for a still of a label, and rejects another purpose', () => {
    expect(parseServerToDevice({ t: 'still.request', purpose: 'label' })).toEqual({ t: 'still.request', purpose: 'label' });
    expect(parseServerToDevice({ t: 'still.request', purpose: 'face' })).toBeNull();
    expect(parseServerToDevice({ t: 'still.request' })).toBeNull();
  });
  it('accepts a line with no clip', () => {
    const speak = { t: 'speak', id: 's-1', priority: 'normal', text: 'Skipped.', lang: 'en', url: null,
      sound: null, interrupt: false, promptId: null };
    expect(parseServerToDevice(speak)).toEqual(speak);
  });
});
