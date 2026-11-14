import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema } from '@glance/shared';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FAKE_PRODUCT_INFO_DIR } from '../products/fakeProductInfo';
import { createOpenFoodFactsInfo } from '../products/openFoodFacts';
import { DEFAULT_STORE_LIST_PATH, readStoreListFile } from '../products/storeList';
import type { FetchFn } from '../speech/elevenlabs';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';
import type { Recognizer } from './gemini';
import { NO_RESULT, type RecognitionResult } from './result';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const ok: RecognitionResult = { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.9 };

let recognize: ReturnType<typeof vi.fn<Recognizer['recognize']>>;
let logLines: string[];
let apps: TestApp[];
let t: TestApp;
let sessionId: string;
let token: string;
let phone: TestPhone;

/** A test app with the stub recognizer, one session, and its phone. The log lines go to `logLines`. */
async function appWithPhone(env: Record<string, string> = {}): Promise<{ t: TestApp; sessionId: string; token: string; phone: TestPhone }> {
  const app = await testApp(env, {
    recognizer: { recognize },
    log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
  apps.push(app);
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${app.base}/api/sessions`, { method: 'POST' })).json());
  const appPhone = await connectPhone(app, created.sessionId, created.token);
  await appPhone.next((m) => m.t === 'snapshot');
  return { t: app, sessionId: created.sessionId, token: created.token, phone: appPhone };
}
const logged = (text: string) => logLines.filter((line) => line.includes(text)).length;

beforeEach(async () => {
  recognize = vi.fn<Recognizer['recognize']>(async () => ok);
  logLines = [];
  apps = [];
  ({ t, sessionId, token, phone } = await appWithPhone());
});
afterEach(async () => {
  for (const app of apps) await app.close();
});

it('a frame from the phone becomes a spoken glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001',
  });
});
it('gives the recognizer the JPEG of the frame, and tells a still from a frame', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.sendFrame({ seq: 2, ts: 2, w: 1440, h: 1080, blurred: true, kind: 'still' }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect([...recognize.mock.calls[0]![0]]).toEqual([...JPEG]);
  expect(recognize.mock.calls.map((call) => call[1].still)).toEqual([false, true]);
});
it('logs the status and the time of each call', async () => {
  phone.sendFrame({ seq: 5, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  expect(logLines.join('')).toMatch(new RegExp(`recognition session=${sessionId} seq=5 status=identified code=no ms=\\d+`));
});
it('logs where the time from the frame to the spoken line went', async () => {
  phone.sendFrame({ seq: 5, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  await vi.waitFor(() => expect(logLines.join('')).toMatch(
    new RegExp(`glance timing session=${sessionId} product=oat-drink-1l frameToResultMs=\\d+ resolveMs=0 clipMs=\\d+`),
  ));
});
it('a frame with blurred false still becomes a glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  await phone.next((m) => m.t === 'speak');
  expect(recognize).toHaveBeenCalledTimes(1);
});
it('warns one time for each session about frames that are not blurred', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: false }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(logged('frame not blurred: the phone did not run face detection')).toBe(1);
});
it('with REQUIRE_BLUR a frame with blurred false never reaches the recognizer', async () => {
  const strict = await appWithPhone({ REQUIRE_BLUR: '1' });
  strict.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  strict.phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: false }, JPEG);
  strict.phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await strict.phone.next((m) => m.t === 'speak');
  expect(recognize).not.toHaveBeenCalled();
  expect(logged('frame dropped: not blurred')).toBe(1);
});
it('with REQUIRE_BLUR a blurred frame still becomes a glance', async () => {
  const strict = await appWithPhone({ REQUIRE_BLUR: '1' });
  strict.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await strict.phone.next((m) => m.t === 'speak')).toMatchObject({ promptId: 'p-0001' });
});
it('the call excludes a product that the shopper just skipped', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.send({ t: 'intent', kind: 'no', source: 'phone', promptId: 'p-0001' });
  await phone.next((m) => m.t === 'speak' && m.text === 'Skipped.');
  phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(recognize.mock.calls[1]![1].exclude).toEqual(['oat-drink-1l']);
});
it('reports a recognizer that fails 3 times in a row, and keeps the socket open', async () => {
  recognize.mockRejectedValue(new Error('503 overloaded'));
  for (const seq of [1, 2, 3]) {
    phone.sendFrame({ seq, ts: seq, w: 576, h: 768, blurred: true }, JPEG);
    await vi.waitFor(() => expect(logged(`recognition call failed. seq=${seq} Error: 503 overloaded`)).toBe(1));
  }
  expect(logged(`recognition is slow for the session ${sessionId}`)).toBe(1);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({ text: 'Recognition is slow right now.', priority: 'high' });
  expect(await phone.next((m) => m.t === 'event' && m.event.type === 'error')).toMatchObject({ event: { code: 'recognition.slow' } });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  expect(await phone.next((m) => m.t === 'speak' && m.priority === 'low')).toBeDefined();
});
it('runs 8 calls of one session at the same time, and the next frame waits', async () => {
  recognize.mockImplementation(() => new Promise(() => undefined));
  for (let seq = 1; seq <= 9; seq += 1) phone.sendFrame({ seq, ts: seq, w: 576, h: 768, blurred: true }, JPEG);
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await phone.next((m) => m.t === 'speak');
  expect(recognize).toHaveBeenCalledTimes(8);
});
it('with RECOGNITION_CONCURRENCY=1 one call runs at a time', async () => {
  recognize.mockImplementation(() => new Promise(() => undefined));
  const single = await appWithPhone({ RECOGNITION_CONCURRENCY: '1' });
  for (const seq of [1, 2, 3]) single.phone.sendFrame({ seq, ts: seq, w: 576, h: 768, blurred: true }, JPEG);
  single.phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await single.phone.next((m) => m.t === 'speak');
  expect(recognize).toHaveBeenCalledTimes(1);
});
it('ends the call of a session that a client deletes', async () => {
  let signal: AbortSignal | null = null;
  recognize.mockImplementationOnce((_jpeg, opts) => {
    signal = opts.signal;
    return new Promise(() => undefined);
  });
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(signal).not.toBeNull());
  await fetch(`${t.base}/api/sessions/${sessionId}?token=${token}`, { method: 'DELETE' });
  await vi.waitFor(() => expect(signal!.aborted).toBe(true));
});
it('ends each call when the app closes', async () => {
  let signal: AbortSignal | null = null;
  recognize.mockImplementationOnce((_jpeg, opts) => {
    signal = opts.signal;
    return new Promise(() => undefined);
  });
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(signal).not.toBeNull());
  await t.close();
  expect(signal!.aborted).toBe(true);
});
it('with SECOND_LOOK_WAIT_MS the look-alike line waits, and a sure still gives the glance in its place', async () => {
  const ambiguous: RecognitionResult = { ...NO_RESULT, status: 'ambiguous', candidates: ['oat-drink-1l', 'oat-drink-barista-1l'] };
  recognize.mockImplementation(async (_jpeg, opts) => (opts.still ? ok : ambiguous));
  const waiting = await appWithPhone({ SECOND_LOOK_WAIT_MS: '10000' });
  waiting.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await waiting.phone.next((m) => m.t === 'event' && m.event.type === 'glance.ambiguous');
  waiting.phone.sendFrame({ seq: 2, ts: 2, w: 1440, h: 1080, blurred: true, kind: 'still' }, JPEG);
  await waiting.phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  await waiting.phone.next((m) => m.t === 'speak');
  expect(waiting.phone.messages.flatMap((m) => (m.t === 'speak' ? [m.text] : []))).toEqual(['Oat drink, one litre, one eighty-nine. Nod to add.']);
});
it('with SECOND_LOOK_WAIT_MS a still that is not sure speaks the look-alike line at once', async () => {
  const ambiguous: RecognitionResult = { ...NO_RESULT, status: 'ambiguous', candidates: ['oat-drink-1l', 'oat-drink-barista-1l'] };
  recognize.mockResolvedValue(ambiguous);
  const waiting = await appWithPhone({ SECOND_LOOK_WAIT_MS: '10000' });
  waiting.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await waiting.phone.next((m) => m.t === 'event' && m.event.type === 'glance.ambiguous');
  // The same result for a stream frame would say nothing for 10 seconds.
  waiting.phone.sendFrame({ seq: 2, ts: 2, w: 1440, h: 1080, blurred: true, kind: 'still' }, JPEG);
  await waiting.phone.next((m) => m.t === 'speak');
  expect(waiting.phone.messages.flatMap((m) => (m.t === 'speak' ? [m.text] : []))).toEqual(['I cannot tell which oat drink this is. Turn the front to me.']);
});

it('a store item that sight names gets the normal prompt, with the details that the resolver reads for its first prompt', async () => {
  const details = { brand: 'Ferrero', quantity: '400 g', allergens: ['milk' as const, 'nuts' as const], vegan: false, vegetarian: true };
  const info = { byGtin: vi.fn(async () => details), cached: vi.fn(async () => null), holds: async () => true };
  recognize.mockResolvedValue({ ...NO_RESULT, status: 'identified', productId: 'gtin-3017624010701', confidence: 0.9 });
  const app = await testApp({}, { recognizer: { recognize }, productInfo: info });
  apps.push(app);
  // The start reads the whole store list from the cache, and makes no read of the database.
  expect(info.cached).toHaveBeenCalledTimes(10);
  expect(info.byGtin).not.toHaveBeenCalled();

  const res = await fetch(`${app.base}/api/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: { allergens: ['nuts'] } }),
  });
  const created = CreateSessionResponseSchema.parse(await res.json());
  const storePhone = await connectPhone(app, created.sessionId, created.token);
  storePhone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await storePhone.next((m) => m.t === 'speak')).toMatchObject({
    text: expect.stringContaining('Nutella, four hundred grams, three ninety-nine. Warning: contains nuts.'), promptId: 'p-0001',
  });
  expect(info.byGtin).toHaveBeenCalledWith('3017624010701');
});
it('with a real product reader the start reads the details in the background, and the prompt of that item makes no read', async () => {
  const NUTELLA = '3017624010701';
  const cacheDir = mkdtempSync(join(tmpdir(), 'glance-products-'));
  const offFetch = vi.fn<FetchFn>(async (url) => {
    const gtin = /product\/(\d+)/.exec(String(url))![1]!;
    return new Response(readFileSync(`${FAKE_PRODUCT_INFO_DIR}/${gtin}.json`, 'utf8'), { status: 200 });
  });
  const productInfo = createOpenFoodFactsInfo({ baseUrl: 'https://off.test', userAgent: 'test', cacheDir, fetch: offFetch });
  recognize.mockResolvedValue({ ...NO_RESULT, status: 'identified', productId: `gtin-${NUTELLA}`, confidence: 0.9 });
  const app = await testApp({ FAKE_PRODUCT_INFO: '0' }, {
    recognizer: { recognize }, productInfo, log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
  apps.push(app);
  try {
    // The Nutella is the first item of the dev store list, so the warm-up reads it at once. The next read is 5 seconds later.
    await vi.waitFor(() => expect(offFetch).toHaveBeenCalledTimes(1));
    expect(String(offFetch.mock.calls[0]![0])).toContain(NUTELLA);
    expect(logged('product info: warm-up started. 9 of 9 store items are not in the cache, one read each 5 s')).toBe(1);
    await vi.waitFor(async () => expect(await productInfo.holds(NUTELLA)).toBe(true));
    const res = await fetch(`${app.base}/api/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: { allergens: ['nuts'] } }),
    });
    const created = CreateSessionResponseSchema.parse(await res.json());
    const storePhone = await connectPhone(app, created.sessionId, created.token);
    storePhone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
    expect(await storePhone.next((m) => m.t === 'speak')).toMatchObject({
      text: expect.stringContaining('Nutella, four hundred grams, three ninety-nine. Warning: contains nuts.'),
    });
    expect(offFetch).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    rmSync(cacheDir, { recursive: true, force: true });
  }
});
it('with fake product details the start makes no warm-up', async () => {
  expect(logged('warm-up')).toBe(0);
});
it('a store item that the store list no longer holds gets no prompt', async () => {
  const items = await readStoreListFile(DEFAULT_STORE_LIST_PATH).all();
  let sold = true;
  const storeList = { all: async () => items, byGtin: async (gtin: string) => (sold ? items.find((item) => item.gtin === gtin) : undefined) };
  recognize.mockResolvedValue({ ...NO_RESULT, status: 'identified', productId: 'gtin-3017624010701', confidence: 0.9 });
  const app = await testApp({}, {
    recognizer: { recognize }, storeList, log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
  apps.push(app);
  sold = false;
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${app.base}/api/sessions`, { method: 'POST' })).json());
  const storePhone = await connectPhone(app, created.sessionId, created.token);
  storePhone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(logged('recognition result dropped: the store does not sell gtin-3017624010701')).toBe(1));
  expect(storePhone.messages.some((m) => m.t === 'speak')).toBe(false);
});
it('a store item whose read fails still gets its prompt, with the details of the start', async () => {
  const items = await readStoreListFile(DEFAULT_STORE_LIST_PATH).all();
  let down = false;
  const storeList = {
    all: async () => items,
    byGtin: async (gtin: string) => {
      if (down) throw new Error('The ERP is down.');
      return items.find((item) => item.gtin === gtin);
    },
  };
  recognize.mockResolvedValue({ ...NO_RESULT, status: 'identified', productId: 'gtin-3017624010701', confidence: 0.9 });
  const app = await testApp({}, {
    recognizer: { recognize }, storeList, log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
  apps.push(app);
  down = true;
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${app.base}/api/sessions`, { method: 'POST' })).json());
  const storePhone = await connectPhone(app, created.sessionId, created.token);
  storePhone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await storePhone.next((m) => m.t === 'speak')).toMatchObject({ text: 'Nutella, four hundred grams, three ninety-nine. Nod to add.' });
  expect(logged('product not read again. id=gtin-3017624010701 The ERP is down.')).toBe(1);
});
