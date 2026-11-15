import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ServerToDevice } from '@glance/shared';
import type { LabelReader } from '../label/reader';
import { NO_LABEL } from '../label/reader';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';

const NUTELLA = '3017624010701';
const JPEG = new Uint8Array([0xff, 0xd8, 0x01, 0xff, 0xd9]);
const label = { seq: 9, ts: 9, w: 1080, h: 1440, blurred: true, kind: 'label' as const };
const isReferenceRequest = (m: ServerToDevice) => m.t === 'still.request' && m.purpose === 'reference';

let dir: string;
let t: TestApp;
let read: ReturnType<typeof vi.fn<LabelReader['read']>>;
let phones: TestPhone[];
let logLines: string[];

const call = (method: string, path: string, app: TestApp = t) => fetch(`${app.base}${path}`, { method });
async function phone(): Promise<TestPhone> {
  const created = CreateSessionResponseSchema.parse(await (await call('POST', '/api/sessions')).json());
  const connected = await connectPhone(t, created.sessionId, created.token);
  phones.push(connected);
  await connected.next((m) => m.t === 'snapshot');
  return connected;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'glance-reference-http-'));
  read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  phones = [];
  logLines = [];
  t = await testApp({ DEMO_KEY: 'k-demo', REFERENCE_DIR: dir }, {
    labelReader: { read }, log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
});
afterEach(async () => {
  vi.useRealTimers();
  for (const connected of phones) connected.close();
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

it('saves the next label frame of the newest session as a reference picture, with no label call and no line', async () => {
  const older = await phone();
  const newest = await phone();
  const answer = call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  expect(await newest.next(isReferenceRequest)).toEqual({ t: 'still.request', purpose: 'reference' });
  newest.sendFrame(label, JPEG);

  const response = await answer;
  expect(response.status).toBe(201);
  const body = await response.json() as { file: string };
  expect(body).toEqual({ gtin: NUTELLA, name: 'Nutella', file: body.file, bytes: 5, width: 1080, height: 1440, count: 1 });
  expect(body.file).toMatch(/^\d+\.jpg$/);
  expect([...readFileSync(join(dir, NUTELLA, body.file))]).toEqual([...JPEG]);

  expect(read).not.toHaveBeenCalled();
  expect(newest.messages.some((m) => m.t === 'speak')).toBe(false);
  expect(older.messages.some((m) => m.t === 'still.request')).toBe(false);
  expect(logLines.join('\n')).not.toContain('k-demo');
});
it('the label frame after the marked one goes to the label call, with the stored picture', async () => {
  const shopper = await phone();
  const answer = call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  await shopper.next(isReferenceRequest);
  shopper.sendFrame(label, JPEG);
  expect((await answer).status).toBe(201);

  shopper.sendFrame({ ...label, seq: 10 }, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  expect(read.mock.calls[0]![1].references).toEqual([{ gtin: NUTELLA, name: 'Nutella', jpeg: JPEG }]);
});
it('takes a code of 8 or 12 digits and stores the picture under its 13 digits', async () => {
  const shopper = await phone();
  const answer = call('POST', '/api/demo/reference?key=k-demo&gtin=80177173');
  await shopper.next(isReferenceRequest);
  shopper.sendFrame(label, JPEG);
  expect(await (await answer).json()).toMatchObject({ gtin: '0000080177173', name: 'Nutella', count: 1 });
  expect(readdirSync(dir)).toEqual(['0000080177173']);
});
it('answers 504 when no label frame comes in 15 seconds, and the mark is gone', async () => {
  const shopper = await phone();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const answer = call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  await shopper.next(isReferenceRequest);
  await vi.advanceTimersByTimeAsync(15_000);
  const response = await answer;
  expect(response.status).toBe(504);
  expect(await response.json()).toEqual({ error: 'timeout' });
  vi.useRealTimers();

  shopper.sendFrame(label, JPEG);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  expect(existsSync(join(dir, NUTELLA))).toBe(false);
});
it('answers 404 for a wrong key, for no key, and when DEMO_KEY is not set', async () => {
  await phone();
  for (const path of [`/api/demo/reference?key=wrong&gtin=${NUTELLA}`, `/api/demo/reference?gtin=${NUTELLA}`]) {
    for (const method of ['POST', 'GET', 'DELETE']) {
      const response = await call(method, path);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
  }
  const noKey = await testApp({ REFERENCE_DIR: dir });
  try {
    for (const method of ['POST', 'GET', 'DELETE']) {
      expect((await call(method, `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`, noKey)).status).toBe(404);
      expect((await call(method, `/api/demo/reference?key=&gtin=${NUTELLA}`, noKey)).status).toBe(404);
    }
  } finally {
    await noKey.close();
  }
  expect(phones[0]!.messages.some((m) => m.t === 'still.request')).toBe(false);
});
it('answers 400 for a code with a wrong check digit, for a code that the store list does not hold, and for no code', async () => {
  const shopper = await phone();
  // 3017624010702: a wrong check digit. 4006381333931: a right code that the store does not sell.
  for (const query of ['&gtin=3017624010702', '&gtin=4006381333931', '&gtin=abc', '']) {
    const response = await call('POST', `/api/demo/reference?key=k-demo${query}`);
    expect(response.status, query).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad_request' });
  }
  expect(shopper.messages.some((m) => m.t === 'still.request')).toBe(false);
});
it('answers 409 with no live session, and with a session that has no phone', async () => {
  const none = await call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  expect(none.status).toBe(409);
  expect(await none.json()).toEqual({ error: 'no_session' });
  await call('POST', '/api/sessions');
  const noPhone = await call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  expect(noPhone.status).toBe(409);
  expect(await noPhone.json()).toEqual({ error: 'no_phone' });
});
it('lists each store item with its picture count, and removes the pictures of one item', async () => {
  const shopper = await phone();
  const answer = call('POST', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  await shopper.next(isReferenceRequest);
  shopper.sendFrame(label, JPEG);
  await answer;

  const listed = await (await call('GET', '/api/demo/reference?key=k-demo')).json() as { items: { gtin: string; name: string; pictures: number }[] };
  expect(listed.items).toHaveLength(10);
  expect(listed.items[0]).toEqual({ gtin: NUTELLA, name: 'Nutella', pictures: 1 });
  expect(listed.items[2]).toEqual({ gtin: '8076800195057', name: 'Spaghetti n.5', pictures: 0 });

  const removed = await call('DELETE', `/api/demo/reference?key=k-demo&gtin=${NUTELLA}`);
  expect(removed.status).toBe(200);
  expect(await removed.json()).toEqual({ gtin: NUTELLA, removed: 1 });
  expect(existsSync(join(dir, NUTELLA))).toBe(false);
  expect((await call('DELETE', '/api/demo/reference?key=k-demo&gtin=123')).status).toBe(400);
});
