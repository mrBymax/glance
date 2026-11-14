import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ProfilePatch, type ServerEvent, type ServerToDevice } from '@glance/shared';
import type { AppDeps } from '../app';
import type { LabelAnswer, LabelReader } from '../label/reader';
import type { Recognizer } from '../recognition/gemini';
import { NO_RESULT, type RecognitionResult } from '../recognition/result';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';

// Each app of this file reads the product details from the fixtures of FAKE_PRODUCT_INFO, or from a reader of the test.

const NUTELLA = '3017624010701';
const SPAGHETTI = '8076800195057';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const frame = { seq: 1, ts: 1, w: 576, h: 768, blurred: true };
const label = { seq: 9, ts: 9, w: 1440, h: 1080, blurred: true, kind: 'label' as const };

type Speak = Extract<ServerToDevice, { t: 'speak' }>;
const isSpeak = (m: ServerToDevice): m is Speak => m.t === 'speak';
const isEvent = (type: ServerEvent['type']) => (m: ServerToDevice) => m.t === 'event' && m.event.type === type;
const eventOf = <K extends ServerEvent['type']>(m: ServerToDevice) => (m as unknown as { event: Extract<ServerEvent, { type: K }> }).event;

const tempDir = mkdtempSync(join(tmpdir(), 'glance-barcode-'));
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));
let fileCount = 0;
function tempScript(script: object): string {
  fileCount += 1;
  const path = join(tempDir, `script-${fileCount}.json`);
  writeFileSync(path, JSON.stringify({ loop: false, lengthMs: 60000, ...script }));
  return path;
}

let apps: TestApp[] = [];
let phones: TestPhone[] = [];
afterEach(async () => {
  for (const phone of phones) phone.close();
  for (const app of apps) await app.close();
  apps = [];
  phones = [];
});

type Shop = { t: TestApp; id: string; token: string; phone: TestPhone };
/** A test app, one session with the profile, and its phone. */
async function shop(over: Partial<AppDeps> = {}, env: Record<string, string> = {}, profile: ProfilePatch = {}): Promise<Shop> {
  const t = await testApp(env, over);
  apps.push(t);
  const res = await fetch(`${t.base}/api/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile }),
  });
  const { sessionId: id, token } = CreateSessionResponseSchema.parse(await res.json());
  const phone = await connectPhone(t, id, token);
  phones.push(phone);
  await phone.next((m) => m.t === 'snapshot');
  return { t, id, token, phone };
}
/** Resolves when the server has read each message that the phone sent before the call, and each lookup is done. */
async function serverReadAll(phone: TestPhone): Promise<void> {
  const before = phone.messages.filter((m) => m.t === 'snapshot').length;
  phone.send({ t: 'profile.set', patch: {} });
  await vi.waitFor(() => expect(phone.messages.filter((m) => m.t === 'snapshot').length).toBe(before + 1));
  await new Promise((resolve) => setTimeout(resolve, 50));
}
/** Scans a code, waits for its prompt, and answers yes from the phone. */
async function scanAndAdd(phone: TestPhone, code: string): Promise<void> {
  const seen = phone.messages.length;
  phone.send({ t: 'barcode.seen', code, source: 'barcode' });
  const pending = await phone.next((m) => phone.messages.indexOf(m) >= seen && isEvent('glance.pending')(m));
  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId: eventOf<'glance.pending'>(pending).promptId });
  await phone.next((m) => phone.messages.indexOf(m) >= seen && isEvent('cart.updated')(m));
}

it('a barcode of a store item gives the prompt with the price of the store, and a yes adds it', async () => {
  const { phone } = await shop();
  phone.send({ t: 'barcode.seen', code: NUTELLA, source: 'barcode' });
  const pending = eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending')));
  expect(pending).toMatchObject({
    kind: 'new', product: { id: 'gtin-3017624010701', name: 'Nutella', packSize: '400 g', priceCents: 399 }, warnings: [], qtyInCart: 0,
  });
  const line = await phone.next(isSpeak) as Speak;
  expect(line).toMatchObject({ text: 'Nutella, four hundred grams, three ninety-nine. Nod to add.', promptId: pending.promptId });

  phone.send({ t: 'prompt.done', promptId: pending.promptId });
  phone.send({ t: 'intent', kind: 'yes', source: 'voice', promptId: pending.promptId });
  const cart = eventOf<'cart.updated'>(await phone.next(isEvent('cart.updated')));
  expect(cart.cart).toEqual({
    items: [{ productId: 'gtin-3017624010701', name: 'Nutella', packSize: '400 g', qty: 1, unitPriceCents: 399 }], totalCents: 399,
  });
  expect(await phone.next((m) => isSpeak(m) && m.sound === 'added')).toMatchObject({ text: 'Added Nutella. Total three ninety-nine.' });
});
it('the reports of one appearance give one prompt', async () => {
  const { phone } = await shop();
  for (const source of ['barcode', 'ocr', 'barcode'] as const) phone.send({ t: 'barcode.seen', code: NUTELLA, source });
  await serverReadAll(phone);
  expect(phone.messages.filter(isEvent('glance.pending'))).toHaveLength(1);
});
it('a code that the store list does not hold gives the line and no prompt', async () => {
  const { phone } = await shop();
  phone.send({ t: 'barcode.seen', code: '4006381333931', source: 'barcode' });
  expect(await phone.next(isSpeak)).toMatchObject({ text: 'This product is not in this store.', promptId: null, sound: null });
  await serverReadAll(phone);
  expect(phone.messages.some(isEvent('glance.pending'))).toBe(false);
  expect(phone.messages.filter(isSpeak)).toHaveLength(1);
});
it('an invalid code gives nothing', async () => {
  const { phone } = await shop();
  phone.send({ t: 'barcode.seen', code: '3017624010702', source: 'ocr' });
  phone.send({ t: 'barcode.seen', code: '10036000291452', source: 'barcode' });
  await serverReadAll(phone);
  expect(phone.messages.filter((m) => m.t === 'speak' || m.t === 'event')).toEqual([]);
});
it('with Open Food Facts down the prompt has the name of the store, and the allergen data is missing', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const down = { byGtin: vi.fn(async () => { throw new Error('Open Food Facts answered 503.'); }) };
    const { phone } = await shop({ productInfo: down }, {}, { allergens: ['nuts'] });
    phone.send({ t: 'barcode.seen', code: '8076809513753', source: 'barcode' });
    const pending = eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending')));
    expect(pending).toMatchObject({
      product: { id: 'gtin-8076809513753', name: 'Pesto alla genovese', packSize: '190 g', priceCents: 289 },
      warnings: [{ kind: 'allergenDataMissing' }],
    });
    expect(await phone.next(isSpeak)).toMatchObject({
      text: 'Pesto alla genovese, one hundred ninety grams, two eighty-nine. Allergen data is missing for this product. Nod to add.',
      sound: 'warning',
    });
    expect(down.byGtin).toHaveBeenCalledWith('8076809513753');
  } finally {
    error.mockRestore();
  }
});
it('warns about an allergen and a trace of the database', async () => {
  const { phone } = await shop({}, {}, { allergens: ['eggs', 'gluten'], vegan: true });
  phone.send({ t: 'barcode.seen', code: SPAGHETTI, source: 'barcode' });
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).warnings).toEqual([
    { kind: 'allergen', allergens: ['eggs', 'gluten'] }, { kind: 'allergenDataMissing' },
  ]);
});
it('a code of a catalog product gives that product, with the texts of the catalog', async () => {
  const { phone } = await shop();
  phone.send({ t: 'barcode.seen', code: '7394376616037', source: 'barcode' });
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product)
    .toEqual({ id: 'oat-drink-barista-1l', name: 'Barista oat drink', packSize: '1 L', priceCents: 229 });
});
it('a code of 8 digits finds its item', async () => {
  const { phone } = await shop();
  phone.send({ t: 'barcode.seen', code: '80177173', source: 'barcode' });
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product)
    .toEqual({ id: 'gtin-0000080177173', name: 'Nutella', packSize: '15 g', priceCents: 45 });
});

it('the snapshot, a question, the cart by voice, and a new language find a scanned product', async () => {
  const ask = vi.fn<NonNullable<AppDeps['ask']>>(async () => 'It contains gluten.');
  const { t, id, token, phone } = await shop({ ask });
  phone.send({ t: 'barcode.seen', code: SPAGHETTI, source: 'barcode' });
  const pending = eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending')));

  const snapshot = await (await fetch(`${t.base}/api/sessions/${id}?token=${token}`)).json() as { prompt: unknown };
  expect(snapshot.prompt).toMatchObject({ kind: 'product', product: { id: 'gtin-8076800195057', priceCents: 109 } });

  phone.send({ t: 'intent', kind: 'ask', source: 'phone' });
  phone.send({ t: 'speech.final', text: 'Does it contain gluten?', confidence: 0.9, locale: 'en-US' });
  expect(await phone.next((m) => isSpeak(m) && m.text === 'It contains gluten.')).toBeTruthy();
  expect(ask.mock.calls[0]![1]).toMatchObject({ id: 'gtin-8076800195057', brand: 'Barilla', allergens: ['gluten', 'eggs', 'soy', 'mustard'] });

  phone.send({ t: 'intent', kind: 'yes', source: 'phone', promptId: pending.promptId });
  await phone.next(isEvent('cart.updated'));
  phone.send({ t: 'intent', kind: 'cart', source: 'phone' });
  expect(await phone.next((m) => isSpeak(m) && m.text.includes(', one.'))).toMatchObject({ text: 'Spaghetti n.5, one. Total one oh nine.' });

  phone.send({ t: 'profile.set', patch: { lang: 'it' } });
  const renamed = await phone.next((m) => isEvent('cart.updated')(m) && eventOf<'cart.updated'>(m).change === null);
  expect(eventOf<'cart.updated'>(renamed).cart.items[0]).toMatchObject({ name: 'Spaghetti n.5', unitPriceCents: 109 });
});
it('a spot check asks for a scanned product, and its barcode passes the check', async () => {
  const { t, phone } = await shop();
  const kiosk = await t.app.kiosks.register({ name: 'Checkout 4', store: 'Demo Market', spotCheck: true });
  await scanAndAdd(phone, NUTELLA);
  phone.send({ t: 'kiosk.seen', text: `GL1 ${kiosk.code}` });
  expect(eventOf<'checkout.spotcheck'>(await phone.next(isEvent('checkout.spotcheck'))).product.id).toBe('gtin-3017624010701');
  // The product stays muted after the add until it has left the view, and it still passes the check.
  phone.send({ t: 'barcode.seen', code: NUTELLA, source: 'barcode' });
  expect(await phone.next((m) => isSpeak(m) && m.text === 'Thank you.')).toBeTruthy();
});
it('a stored session with a scanned product in its cart works after a restart of the server', async () => {
  const first = await shop();
  await scanAndAdd(first.phone, NUTELLA);
  await (await first.t.app.sessions.get(first.id))!.settled();
  first.phone.close();
  const record = await first.t.store.getSession(first.id);
  expect(record!.cart.items).toHaveLength(1);

  const second = await testApp({}, { store: first.t.store });
  apps.push(second);
  const phone = await connectPhone(second, first.id, first.token);
  phones.push(phone);
  const snapshot = await phone.next((m) => m.t === 'snapshot') as Extract<ServerToDevice, { t: 'snapshot' }>;
  expect(snapshot.session.cart.totalCents).toBe(399);

  phone.send({ t: 'intent', kind: 'cart', source: 'phone' });
  expect(await phone.next((m) => isSpeak(m) && m.text.startsWith('Nutella'))).toMatchObject({ text: 'Nutella, one. Total three ninety-nine.' });
  phone.send({ t: 'intent', kind: 'undo', source: 'phone' });
  expect(await phone.next((m) => isSpeak(m) && m.sound === 'removed')).toMatchObject({ text: 'Removed Nutella. Total zero euros.' });
});

it('a stored session with a prompt for a scanned product keeps the prompt after a restart of the server', async () => {
  const first = await shop();
  first.phone.send({ t: 'barcode.seen', code: SPAGHETTI, source: 'barcode' });
  await first.phone.next(isEvent('glance.pending'));
  await (await first.t.app.sessions.get(first.id))!.settled();
  first.phone.close();

  const second = await testApp({}, { store: first.t.store });
  apps.push(second);
  const phone = await connectPhone(second, first.id, first.token);
  phones.push(phone);
  const snapshot = await phone.next((m) => m.t === 'snapshot') as Extract<ServerToDevice, { t: 'snapshot' }>;
  expect(snapshot.session.prompt).toMatchObject({ kind: 'product', product: { id: 'gtin-8076800195057', priceCents: 109 } });
});
it('a stored session loads after a restart when the store list fails, and keeps its cart', async () => {
  const first = await shop();
  await scanAndAdd(first.phone, NUTELLA);
  await (await first.t.app.sessions.get(first.id))!.settled();
  first.phone.close();

  const down = { byGtin: async () => { throw new Error('The ERP is down.'); }, all: async () => [] };
  const second = await testApp({}, { store: first.t.store, storeList: down });
  apps.push(second);
  const phone = await connectPhone(second, first.id, first.token);
  phones.push(phone);
  const snapshot = await phone.next((m) => m.t === 'snapshot') as Extract<ServerToDevice, { t: 'snapshot' }>;
  expect(snapshot.session.cart).toMatchObject({ items: [{ productId: 'gtin-3017624010701', qty: 1 }], totalCents: 399 });
});

/** A recognizer that answers each frame with the next result of the list, and then with the last one. */
function recognizerOf(results: Partial<RecognitionResult>[]): Recognizer {
  let index = 0;
  return {
    recognize: async () => {
      const part = results[Math.min(index, results.length - 1)]!;
      index += 1;
      return { ...NO_RESULT, ...part };
    },
  };
}

it('digits that the model read, with a right check digit and in the store list, give the product after one frame', async () => {
  const { phone } = await shop({ recognizer: recognizerOf([{ code: { visible: true, digits: NUTELLA } }]) });
  phone.sendFrame(frame, JPEG);
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product.id).toBe('gtin-3017624010701');
});
it('digits of the model that the store list does not hold, or with a wrong check digit, give no line', async () => {
  const recognizer = recognizerOf([{ code: { visible: true, digits: '4006381333931' } }, { code: { visible: true, digits: '3017624010702' } }]);
  const lines: string[] = [];
  const { phone } = await shop({ recognizer, log: { level: 'info', stream: { write: (line) => { lines.push(line); } } } });
  phone.sendFrame(frame, JPEG);
  await vi.waitFor(() => expect(lines.join('')).toContain('source=model gtin=4006381333931 outcome=notInStore'));
  phone.sendFrame({ ...frame, seq: 2 }, JPEG);
  await vi.waitFor(() => expect(lines.join('')).toContain('source=model gtin=3017624010702 outcome=invalid'));
  await serverReadAll(phone);
  expect(phone.messages.filter(isSpeak)).toEqual([]);
});
it('a code that the model sees in 2 frames and cannot read asks the phone for a still', async () => {
  const { phone } = await shop({ recognizer: recognizerOf([{ status: 'unsure', aimHint: 'turn', code: { visible: true, digits: null } }]) });
  phone.sendFrame(frame, JPEG);
  await serverReadAll(phone);
  expect(phone.messages.some((m) => m.t === 'still.request')).toBe(false);
  phone.sendFrame({ ...frame, seq: 2 }, JPEG);
  expect(await phone.next((m) => m.t === 'still.request')).toEqual({ t: 'still.request', purpose: 'label' });
  // One voice: the shopper shows the barcode, so the voice does not say "Turn the front to me."
  await serverReadAll(phone);
  expect(phone.messages.filter(isSpeak)).toEqual([]);
});

const nutellaLabel: LabelAnswer = { digits: [], brand: 'Ferrero', name: 'Nutella', packSize: '400 g', confidence: 0.9 };

it('in fake mode a scripted code asks for a still, and the label frame gives the product through the fake reader', async () => {
  const script = tempScript({
    label: { ...nutellaLabel, digits: [NUTELLA] },
    steps: [{ atMs: 0, forMs: 30000, result: { code: { visible: true, digits: null } } }],
  });
  const { phone } = await shop({}, { FAKE_RECOGNITION: script, GEMINI_API_KEY: '' });
  expect(await phone.next((m) => m.t === 'still.request')).toEqual({ t: 'still.request', purpose: 'label' });
  expect(phone.messages.some(isEvent('glance.pending'))).toBe(false);

  phone.sendFrame(label, JPEG);
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product)
    .toEqual({ id: 'gtin-3017624010701', name: 'Nutella', packSize: '400 g', priceCents: 399 });
  expect(await phone.next(isSpeak)).toMatchObject({ text: 'Nutella, four hundred grams, three ninety-nine. Nod to add.' });
});
it('in fake mode a script with no label answer reads nothing, and the voice says so one time', async () => {
  const lines: string[] = [];
  const { phone } = await shop(
    { log: { level: 'info', stream: { write: (line) => { lines.push(line); } } } },
    { FAKE_RECOGNITION: tempScript({ steps: [] }), GEMINI_API_KEY: '' },
  );
  phone.sendFrame(label, JPEG);
  expect(await phone.next(isSpeak)).toMatchObject({ text: 'I cannot read this code. Hold it closer.', promptId: null });
  expect(lines.join('')).toContain('frame seq=9 w=1440 h=1080 blurred=true kind=label bytes=4');
  phone.sendFrame({ ...label, seq: 10 }, JPEG);
  // The second still comes too early for a second call.
  await vi.waitFor(() => expect(lines.join('')).toMatch(/label frame dropped: the last label call started \d+ ms ago. seq=10/));
  expect(phone.messages.filter(isSpeak)).toHaveLength(1);
});
it('in fake mode a barcode step reports its code as the phone does', async () => {
  const script = tempScript({ steps: [{ atMs: 0, forMs: 5000, barcode: SPAGHETTI }] });
  const { phone } = await shop({}, { FAKE_RECOGNITION: script, GEMINI_API_KEY: '' });
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product)
    .toMatchObject({ id: 'gtin-8076800195057', priceCents: 109 });
});

/** A label reader of a test. `calls` holds the JPEG of each call. */
function labelReaderOf(answer: LabelAnswer | Error): LabelReader & { calls: Uint8Array[] } {
  const calls: Uint8Array[] = [];
  return {
    calls,
    read: async (jpeg) => {
      calls.push(jpeg);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

it('a label frame goes to the label reader and not to recognition, and a match by brand and name gives the product', async () => {
  const recognize = vi.fn<Recognizer['recognize']>(async () => NO_RESULT);
  const reader = labelReaderOf(nutellaLabel);
  const { phone } = await shop({ recognizer: { recognize }, labelReader: reader });
  phone.sendFrame(label, JPEG);
  expect(eventOf<'glance.pending'>(await phone.next(isEvent('glance.pending'))).product.id).toBe('gtin-3017624010701');
  expect(reader.calls.map((jpeg) => [...jpeg])).toEqual([[...JPEG]]);
  expect(recognize).not.toHaveBeenCalled();
});
it('a label that selects no item, and a label call that fails, give the unreadable line', async () => {
  const unknown = await shop({ labelReader: labelReaderOf({ ...nutellaLabel, brand: 'Rigoni', name: 'Nocciolata' }) });
  unknown.phone.sendFrame(label, JPEG);
  expect(await unknown.phone.next(isSpeak)).toMatchObject({ text: 'I cannot read this code. Hold it closer.' });

  const lines: string[] = [];
  const failed = await shop({
    labelReader: labelReaderOf(new Error('503 overloaded')), log: { level: 'info', stream: { write: (line) => { lines.push(line); } } },
  });
  failed.phone.sendFrame(label, JPEG);
  expect(await failed.phone.next(isSpeak)).toMatchObject({ text: 'I cannot read this code. Hold it closer.' });
  expect(lines.join('')).toMatch(/label call failed. seq=9 Error: 503 overloaded/);
});
it('with REQUIRE_BLUR a label frame that is not blurred does not reach the reader', async () => {
  const reader = labelReaderOf(nutellaLabel);
  const lines: string[] = [];
  const { phone } = await shop(
    { labelReader: reader, log: { level: 'info', stream: { write: (line) => { lines.push(line); } } } }, { REQUIRE_BLUR: '1' },
  );
  phone.sendFrame({ ...label, blurred: false }, JPEG);
  await vi.waitFor(() => expect(lines.join('')).toContain('label frame dropped: not blurred'));
  expect(reader.calls).toEqual([]);
});
it('a server with no label reader drops a label frame', async () => {
  const lines: string[] = [];
  const { phone } = await shop({ log: { level: 'info', stream: { write: (line) => { lines.push(line); } } } });
  phone.sendFrame(label, JPEG);
  await vi.waitFor(() => expect(lines.join('')).toContain('label frame dropped: the server has no label reader'));
  expect(phone.messages.filter(isSpeak)).toEqual([]);
});
