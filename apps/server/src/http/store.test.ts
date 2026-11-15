import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ServerEvent, type ServerToDevice } from '@glance/shared';
import type { AppDeps } from '../app';
import { createFakeProductInfo } from '../products/fakeProductInfo';
import { readStoreListFile } from '../products/storeList';
import type { Recognizer } from '../recognition/gemini';
import { NO_RESULT } from '../recognition/result';
import type { Synthesize } from '../speech/elevenlabs';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';
import { MAX_PICTURES_FOR_ITEM, MAX_PICTURE_BYTES, type StoreItemResponse, type StoreItemsResponse, type StorePicturesResponse } from './store';

// No test of this file calls Open Food Facts, Gemini, or ElevenLabs. Each app writes a store list file of the test.

const NUTELLA = '3017624010701';
const SPAGHETTI = '8076800195057';
/** A real code that the dev store list and the fixtures do not hold. */
const NEW = '6430062761795';
/** A code of one store: it starts with 2. */
const STORE_CODE = '2000000000015';
const kili = { name: 'Kili Cascara Yuzu', priceCents: 249, brand: 'Kili', packSize: '330 ml' };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const frame = { seq: 1, ts: 1, w: 576, h: 768, blurred: true };
const DEV_STORE_LIST = fileURLToPath(new URL('../../catalog/store-list.dev.json', import.meta.url));

type Speak = Extract<ServerToDevice, { t: 'speak' }>;
const isSpeak = (m: ServerToDevice): m is Speak => m.t === 'speak';
const isEvent = (type: ServerEvent['type']) => (m: ServerToDevice) => m.t === 'event' && m.event.type === type;
const pendingOf = (m: ServerToDevice) => (m as unknown as { event: Extract<ServerEvent, { type: 'glance.pending' }> }).event;

let dir: string;
let listPath: string;
let referenceDir: string;
let t: TestApp;
let apps: TestApp[];
let phones: TestPhone[];
let logLines: string[];

/** A test app with a store list file and a reference folder of this test. */
async function open(env: Record<string, string> = {}, over: Partial<AppDeps> = {}): Promise<TestApp> {
  const app = await testApp({ REFERENCE_DIR: referenceDir, ...env }, {
    storeList: readStoreListFile(listPath), log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } }, ...over,
  });
  apps.push(app);
  return app;
}
const call = (method: string, path: string, body?: unknown, app: TestApp = t) => fetch(`${app.base}${path}`, {
  method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});
const upload = (gtin: string, jpeg: Uint8Array = JPEG, type = 'image/jpeg', app: TestApp = t) => fetch(`${app.base}/api/store/items/${gtin}/pictures`, {
  method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(jpeg),
});
async function phone(app: TestApp = t): Promise<TestPhone> {
  const created = CreateSessionResponseSchema.parse(await (await call('POST', '/api/sessions', undefined, app)).json());
  const connected = await connectPhone(app, created.sessionId, created.token);
  phones.push(connected);
  await connected.next((m) => m.t === 'snapshot');
  return connected;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'glance-store-http-'));
  listPath = join(dir, 'store-list.json');
  referenceDir = join(dir, 'reference');
  writeFileSync(listPath, readFileSync(DEV_STORE_LIST));
  apps = [];
  phones = [];
  logLines = [];
  t = await open();
});
afterEach(async () => {
  for (const connected of phones) connected.close();
  for (const app of apps) await app.close();
  rmSync(dir, { recursive: true, force: true });
});

it('lists each store item with its picture count, and needs no key', async () => {
  await upload(NUTELLA);
  const response = await call('GET', '/api/store/items');
  expect(response.status).toBe(200);
  const { items } = await response.json() as StoreItemsResponse;
  expect(items).toHaveLength(10);
  expect(items[0]).toEqual({ gtin: NUTELLA, name: 'Nutella', brand: 'Ferrero', packSize: '400 g', priceCents: 399, pictures: 1 });
  expect(items[2]).toMatchObject({ gtin: SPAGHETTI, pictures: 0 });
});
it('gives one item of the store with its pictures and the data of the product database', async () => {
  await upload(SPAGHETTI);
  const body = await (await call('GET', `/api/store/items/${SPAGHETTI}`)).json() as StoreItemResponse;
  expect(body).toMatchObject({
    gtin: SPAGHETTI,
    item: { gtin: SPAGHETTI, name: 'Spaghetti n.5', brand: 'Barilla', packSize: '500 g', priceCents: 109, pictures: 1 },
    picturesUsed: 3, productInfo: 'found', catalogPriceCents: null,
    suggestion: { brand: 'Barilla', packSize: '500 g', vegetarian: true },
  });
  expect(body.pictures).toEqual([{ name: expect.stringMatching(/^\d+\.jpg$/), bytes: JPEG.length, addedAt: expect.any(Number) }]);
  expect(body.suggestion!.names).toContain('Spaghetti n.5');
  expect(body.suggestion!.allergens).toContain('gluten');
});
it('gives the suggestion of the product database for a code that the store does not have', async () => {
  expect((await call('DELETE', `/api/store/items/${SPAGHETTI}`)).status).toBe(200);
  const body = await (await call('GET', `/api/store/items/${SPAGHETTI}`)).json() as StoreItemResponse;
  expect(body).toMatchObject({ gtin: SPAGHETTI, item: null, pictures: [], productInfo: 'found', suggestion: { brand: 'Barilla', packSize: '500 g' } });

  expect(await (await call('GET', `/api/store/items/${NEW}`)).json()).toMatchObject({ item: null, productInfo: 'not_found', suggestion: null });
});
it('says that the read of the product database failed, and still gives the item', async () => {
  const down = await open({}, { productInfo: { ...createFakeProductInfo(), byGtin: async () => { throw new Error('Open Food Facts timed out.'); } } });
  const body = await (await call('GET', `/api/store/items/${NUTELLA}`, undefined, down)).json() as StoreItemResponse;
  expect(body).toMatchObject({ item: { name: 'Nutella' }, productInfo: 'failed', suggestion: null });
});
it('tells the price of a catalog product that has the code', async () => {
  const OAT_DRINK = '7394376616037';
  await call('PUT', `/api/store/items/${OAT_DRINK}`, { name: 'Barista oat drink', priceCents: 259 });
  const body = await (await call('GET', `/api/store/items/${OAT_DRINK}`)).json() as StoreItemResponse;
  expect(body.item).toMatchObject({ priceCents: 259 });
  expect(body.catalogPriceCents).toBe(229);
  // A barcode gives the catalog product, so the prompt has the catalog price.
  const shopper = await phone();
  shopper.send({ t: 'barcode.seen', code: OAT_DRINK, source: 'barcode' });
  expect(pendingOf(await shopper.next(isEvent('glance.pending'))).product).toMatchObject({ id: 'oat-drink-barista-1l', priceCents: 229 });
});
it('takes a code of 8 or 12 digits as its 13 digits, and answers 400 for a wrong code', async () => {
  expect(await (await call('GET', '/api/store/items/80177173')).json()).toMatchObject({ gtin: '0000080177173', item: { priceCents: 45 } });
  expect(await (await call('GET', '/api/store/items/036000291452')).json()).toMatchObject({ gtin: '0036000291452', item: null });
  for (const code of ['3017624010702', '30176240107', 'abc', '10036000291452', '..%2F..%2Fx']) {
    for (const [method, path, body] of [
      ['GET', '', undefined], ['PUT', '', kili], ['DELETE', '', undefined], ['GET', '/pictures', undefined], ['DELETE', '/pictures/1.jpg', undefined],
    ] as const) {
      const response = await call(method, `/api/store/items/${code}${path}`, body);
      expect([code, method, path, response.status]).toEqual([code, method, path, 400]);
      expect(await response.json()).toEqual({ error: 'bad_gtin' });
    }
    expect((await upload(code)).status).toBe(400);
  }
});

it('PUT adds an item to the list and the file, and a second PUT replaces it', async () => {
  const added = await call('PUT', `/api/store/items/${NEW}`, kili);
  expect(added.status).toBe(201);
  expect(await added.json()).toEqual({ gtin: NEW, ...kili, pictures: 0 });
  expect(await readStoreListFile(listPath).byGtin(NEW)).toEqual({ gtin: NEW, ...kili });
  expect((await (await call('GET', '/api/store/items')).json() as StoreItemsResponse).items).toHaveLength(11);

  const replaced = await call('PUT', `/api/store/items/${NEW}`, { name: '  Kili   Yuzu ', priceCents: 199, brand: '', packSize: null });
  expect(replaced.status).toBe(200);
  expect(await replaced.json()).toEqual({ gtin: NEW, name: 'Kili Yuzu', brand: null, packSize: null, priceCents: 199, pictures: 0 });
  expect(await readStoreListFile(listPath).byGtin(NEW)).toEqual({ gtin: NEW, name: 'Kili Yuzu', priceCents: 199 });
  expect(await readStoreListFile(listPath).all()).toHaveLength(11);
  // The dev list of the repository is the source of the test file, and no test writes it.
  expect(await readStoreListFile(DEV_STORE_LIST).byGtin(NEW)).toBeUndefined();
});
it('PUT takes a code of one store', async () => {
  expect((await call('PUT', `/api/store/items/${STORE_CODE}`, { name: 'Bread of the day', priceCents: 150 })).status).toBe(201);
  expect(await (await call('GET', `/api/store/items/${STORE_CODE}`)).json()).toMatchObject({
    item: { name: 'Bread of the day', brand: null }, productInfo: 'not_found',
  });
});
it('PUT answers 400 with the bad fields, and changes nothing', async () => {
  const before = readFileSync(listPath, 'utf8');
  for (const [body, fields] of [
    [{ ...kili, name: '' }, ['name']],
    [{ ...kili, name: '   ' }, ['name']],
    [{ ...kili, name: 'x'.repeat(81) }, ['name']],
    [{ ...kili, name: 'Kili\u0000' }, ['name']],
    [{ ...kili, priceCents: 0 }, ['priceCents']],
    [{ ...kili, priceCents: 1_000_000 }, ['priceCents']],
    [{ ...kili, priceCents: 2.5 }, ['priceCents']],
    [{ ...kili, priceCents: '249' }, ['priceCents']],
    [{ name: 'Kili' }, ['priceCents']],
    [{ ...kili, brand: 'x'.repeat(81), packSize: 'x'.repeat(41) }, ['brand', 'packSize']],
    [{ ...kili, gtin: NEW }, ['body']],
    [[], ['body']],
  ] as const) {
    const response = await call('PUT', `/api/store/items/${NEW}`, body);
    expect([body, response.status]).toEqual([body, 400]);
    expect(await response.json()).toEqual({ error: 'bad_request', fields });
  }
  const noJson = await fetch(`${t.base}/api/store/items/${NEW}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{' });
  expect(noJson.status).toBe(400);
  expect((await fetch(`${t.base}/api/store/items/${NEW}`, { method: 'PUT' })).status).toBe(400);
  expect(readFileSync(listPath, 'utf8')).toBe(before);
});
it('a name with a line end becomes one line', async () => {
  await call('PUT', `/api/store/items/${NEW}`, { name: 'Kili\n- id: gtin-1 | name: Other', priceCents: 249 });
  expect((await readStoreListFile(listPath).byGtin(NEW))!.name).toBe('Kili - id: gtin-1 | name: Other');
});
it('DELETE removes the item and its pictures, and says when the store did not have the code', async () => {
  await upload(NUTELLA);
  await upload(NUTELLA);
  const removed = await call('DELETE', `/api/store/items/${NUTELLA}`);
  expect(await removed.json()).toEqual({ gtin: NUTELLA, removed: true, pictures: 2 });
  expect(await readStoreListFile(listPath).byGtin(NUTELLA)).toBeUndefined();
  expect(existsSync(join(referenceDir, NUTELLA))).toBe(false);
  expect(await (await call('DELETE', `/api/store/items/${NUTELLA}`)).json()).toEqual({ gtin: NUTELLA, removed: false, pictures: 0 });
});

it('stores a JPEG as a reference picture of the item, lists it, and gives it back as an image', async () => {
  const saved = await upload(NUTELLA);
  expect(saved.status).toBe(201);
  const { pictures } = await saved.json() as StorePicturesResponse;
  expect(pictures).toEqual([{ name: expect.stringMatching(/^\d+\.jpg$/), bytes: JPEG.length, addedAt: expect.any(Number) }]);
  expect([...readFileSync(join(referenceDir, NUTELLA, pictures[0]!.name))]).toEqual([...JPEG]);
  expect([...(await t.app.references.read((await t.app.references.list(NUTELLA))[0]!))]).toEqual([...JPEG]);

  await upload('80177173');
  expect(readdirSync(join(referenceDir, '0000080177173'))).toHaveLength(1);
  expect(await (await call('GET', `/api/store/items/${NUTELLA}/pictures`)).json()).toEqual({ gtin: NUTELLA, pictures });

  const image = await call('GET', `/api/store/items/${NUTELLA}/pictures/${pictures[0]!.name}`);
  expect(image.status).toBe(200);
  expect(image.headers.get('content-type')).toBe('image/jpeg');
  expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...JPEG]);
});
it('refuses a body that is no JPEG, another content type, a body above the limit, and a code that the store does not have', async () => {
  const png = await upload(NUTELLA, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  expect([png.status, await png.json()]).toEqual([400, { error: 'not_jpeg' }]);
  expect((await upload(NUTELLA, new Uint8Array(0))).status).toBe(400);
  const typed = await upload(NUTELLA, JPEG, 'image/png');
  expect([typed.status, await typed.json()]).toEqual([415, { error: 'unsupported_media_type' }]);
  const json = await call('POST', `/api/store/items/${NUTELLA}/pictures`, { jpeg: 'x' });
  expect(json.status).toBe(415);
  const large = new Uint8Array(MAX_PICTURE_BYTES + 1);
  large.set(JPEG);
  // The server closes the connection of a body above the limit, so this call goes to the app with no socket.
  const tooLarge = await t.app.inject({
    method: 'POST', url: `/api/store/items/${NUTELLA}/pictures`, headers: { 'content-type': 'image/jpeg' }, payload: Buffer.from(large),
  });
  expect([tooLarge.statusCode, tooLarge.json()]).toEqual([413, { error: 'too_large' }]);
  const unknown = await upload(NEW);
  expect([unknown.status, await unknown.json()]).toEqual([409, { error: 'no_item' }]);
  expect(existsSync(referenceDir) ? readdirSync(referenceDir) : []).toEqual([]);
});
it('takes a picture of 2 MB, and at most 12 pictures for one item', async () => {
  const big = new Uint8Array(2 * 1024 * 1024);
  big.set(JPEG);
  expect((await upload(NUTELLA, big)).status).toBe(201);
  for (let count = 1; count < MAX_PICTURES_FOR_ITEM; count += 1) expect((await upload(NUTELLA)).status).toBe(201);
  const full = await upload(NUTELLA);
  expect([full.status, await full.json()]).toEqual([409, { error: 'too_many_pictures' }]);
});
it('removes one picture by its name, and takes no name with a path', async () => {
  await upload(NUTELLA);
  const { pictures } = await (await upload(NUTELLA)).json() as StorePicturesResponse;
  expect(pictures).toHaveLength(2);
  const [newest, oldest] = pictures;
  writeFileSync(join(dir, 'secret.jpg'), JPEG);

  for (const name of ['..%2F..%2Fsecret.jpg', '..%5C..%5Csecret.jpg', 'none.jpg', `..%2F${NUTELLA}%2F${newest!.name}`]) {
    expect([name, (await call('GET', `/api/store/items/${NUTELLA}/pictures/${name}`)).status]).toEqual([name, 404]);
    expect([name, (await call('DELETE', `/api/store/items/${NUTELLA}/pictures/${name}`)).status]).toEqual([name, 404]);
  }
  expect(existsSync(join(dir, 'secret.jpg'))).toBe(true);

  const removed = await call('DELETE', `/api/store/items/${NUTELLA}/pictures/${newest!.name}`);
  expect(await removed.json()).toEqual({ gtin: NUTELLA, pictures: [oldest] });
  expect(readdirSync(join(referenceDir, NUTELLA))).toEqual([oldest!.name]);
});
it('STORE_EDIT=0 turns each path off, and the paths with a demo key stay as they are', async () => {
  const closed = await open({ STORE_EDIT: '0', DEMO_KEY: 'k-demo' });
  for (const [method, path] of [
    ['GET', '/api/store/items'], ['GET', `/api/store/items/${NUTELLA}`], ['PUT', `/api/store/items/${NEW}`],
    ['DELETE', `/api/store/items/${NUTELLA}`], ['GET', `/api/store/items/${NUTELLA}/pictures`],
  ] as const) {
    const response = await call(method, path, method === 'PUT' ? kili : undefined, closed);
    expect([method, path, response.status]).toEqual([method, path, 404]);
  }
  expect((await upload(NUTELLA, JPEG, 'image/jpeg', closed)).status).toBe(404);
  expect(await readStoreListFile(listPath).byGtin(NUTELLA)).toBeDefined();
  expect((await call('GET', '/api/demo/reference?key=k-demo', undefined, closed)).status).toBe(200);
  expect((await call('GET', '/api/demo/reference', undefined, closed)).status).toBe(404);
});

it('a session that runs gets the prompt of a new item with its price, for its barcode', async () => {
  const shopper = await phone();
  shopper.send({ t: 'barcode.seen', code: NEW, source: 'barcode' });
  expect(await shopper.next(isSpeak)).toMatchObject({ text: 'This product is not in this store.' });

  expect((await call('PUT', `/api/store/items/${NEW}`, kili)).status).toBe(201);
  const other = await phone();
  other.send({ t: 'barcode.seen', code: NEW, source: 'barcode' });
  expect(pendingOf(await other.next(isEvent('glance.pending'))).product)
    .toEqual({ id: `gtin-${NEW}`, name: 'Kili Cascara Yuzu', packSize: '330 ml', priceCents: 249 });
  // The session that was live before the item existed gets it too, with no new connection.
  await vi.waitFor(async () => {
    shopper.send({ t: 'barcode.seen', code: NEW, source: 'barcode' });
    expect(shopper.messages.some(isEvent('glance.pending'))).toBe(true);
  }, { timeout: 10_000, interval: 500 });
  expect(pendingOf(shopper.messages.find(isEvent('glance.pending'))!).product).toMatchObject({ id: `gtin-${NEW}`, priceCents: 249 });
}, 15_000);
it('a new price of an item is the price of the next prompt', async () => {
  const shopper = await phone();
  await call('PUT', `/api/store/items/${NUTELLA}`, { name: 'Nutella', priceCents: 449, brand: 'Ferrero', packSize: '400 g' });
  shopper.send({ t: 'barcode.seen', code: NUTELLA, source: 'barcode' });
  expect(pendingOf(await shopper.next(isEvent('glance.pending'))).product).toMatchObject({ id: `gtin-${NUTELLA}`, priceCents: 449 });
  expect(await shopper.next(isSpeak)).toMatchObject({ text: 'Nutella, four hundred grams, four forty-nine. Nod to add.' });
});
it('a recognition result with the ID of a new item opens its prompt in a session that runs', async () => {
  const seen: { productId: string | null } = { productId: null };
  const recognizer: Recognizer = {
    recognize: async () => ({ ...NO_RESULT, ...(seen.productId === null ? {} : { status: 'identified' as const, productId: seen.productId, confidence: 0.9 }) }),
  };
  const app = await open({}, { recognizer });
  const shopper = await phone(app);
  shopper.sendFrame(frame, JPEG);

  expect((await call('PUT', `/api/store/items/${NEW}`, kili, app)).status).toBe(201);
  seen.productId = `gtin-${NEW}`;
  // A prompt by sight opens with the second result in a row.
  let seq = 1;
  await vi.waitFor(() => {
    seq += 1;
    shopper.sendFrame({ ...frame, seq, ts: seq }, JPEG);
    expect(shopper.messages.some(isEvent('glance.pending'))).toBe(true);
  }, { timeout: 5000, interval: 100 });
  expect(pendingOf(shopper.messages.find(isEvent('glance.pending'))!).product)
    .toEqual({ id: `gtin-${NEW}`, name: 'Kili Cascara Yuzu', packSize: '330 ml', priceCents: 249 });
});
it('after a DELETE the code is not in this store, and a recognition result with its ID opens no prompt', async () => {
  const recognize = vi.fn<Recognizer['recognize']>(async () => ({ ...NO_RESULT, status: 'identified', productId: `gtin-${NUTELLA}`, confidence: 0.9 }));
  const app = await open({}, { recognizer: { recognize } });
  const shopper = await phone(app);
  expect((await call('DELETE', `/api/store/items/${NUTELLA}`, undefined, app)).status).toBe(200);

  shopper.send({ t: 'barcode.seen', code: NUTELLA, source: 'barcode' });
  expect(await shopper.next(isSpeak)).toMatchObject({ text: 'This product is not in this store.', promptId: null });
  let seq = 0;
  await vi.waitFor(() => {
    seq += 1;
    shopper.sendFrame({ ...frame, seq, ts: seq }, JPEG);
    expect(recognize.mock.calls.length).toBeGreaterThanOrEqual(3);
  }, { timeout: 5000, interval: 100 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(shopper.messages.some(isEvent('glance.pending'))).toBe(false);
});
it('makes the clips of the prompt lines of a new item in the background, and none with fake speech', async () => {
  const synthesize = vi.fn<Synthesize>(async () => new Uint8Array([1, 2, 3]));
  // A store with no item: the start makes no clip.
  const emptyList = join(dir, 'empty.json');
  writeFileSync(emptyList, '[]');
  const speaking = await open({ FAKE_SPEECH: '0', ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_VOICE_EN: 'voice-en', SPEECH_WARM_UP: '1' }, {
    synthesize, storeList: readStoreListFile(emptyList),
  });
  expect((await call('PUT', `/api/store/items/${NEW}`, kili, speaking)).status).toBe(201);
  await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3), { timeout: 3000 });
  expect(synthesize.mock.calls[0]![0]).toBe('Kili Cascara Yuzu, three hundred thirty millilitres, two forty-nine. Nod to add.');

  const fake = vi.fn<Synthesize>(async () => new Uint8Array([1]));
  const silent = await open({ SPEECH_WARM_UP: '1' }, { synthesize: fake });
  await call('PUT', `/api/store/items/${STORE_CODE}`, { name: 'Bread', priceCents: 150 }, silent);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(fake).not.toHaveBeenCalled();
});
it('reads the product database for a new item that its cache does not hold, and tells the caller', async () => {
  const fixtures = createFakeProductInfo(fileURLToPath(new URL('../../fixtures/product-info', import.meta.url)));
  // The cache holds each item of the start, so the start reads nothing.
  const held = new Set((await readStoreListFile(listPath).all()).map((item) => item.gtin));
  const reads: string[] = [];
  const told: string[] = [];
  const real = await open({ FAKE_PRODUCT_INFO: '0' }, {
    productInfo: {
      cached: async () => null, holds: async (gtin) => held.has(gtin),
      byGtin: async (gtin) => { reads.push(gtin); held.add(gtin); return fixtures.byGtin(gtin); },
    },
    onProductRead: (gtin) => { told.push(gtin); },
  });
  await call('DELETE', `/api/store/items/${SPAGHETTI}`, undefined, real);
  held.delete(SPAGHETTI);
  await call('PUT', `/api/store/items/${SPAGHETTI}`, { name: 'Spaghetti n.5', priceCents: 119 }, real);
  await vi.waitFor(() => expect(told).toEqual([SPAGHETTI]));
  expect(reads).toEqual([SPAGHETTI]);
  // The rules now hold the product with the details of the database.
  const shopper = await phone(real);
  shopper.send({ t: 'barcode.seen', code: SPAGHETTI, source: 'barcode' });
  expect(pendingOf(await shopper.next(isEvent('glance.pending'))).product).toMatchObject({ packSize: '500 g', priceCents: 119 });
});
it('logs each change with the code, and no body', async () => {
  await call('PUT', `/api/store/items/${NEW}`, kili);
  await upload(NEW);
  await call('DELETE', `/api/store/items/${NEW}`);
  const log = logLines.join('\n');
  expect(log).toContain(`store item added. gtin=${NEW} priceCents=249`);
  expect(log).toContain(`reference picture saved. gtin=${NEW}`);
  expect(log).toContain(`store item removed. gtin=${NEW} pictures=1`);
});
