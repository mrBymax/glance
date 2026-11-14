import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import type { StoreEntry } from '../products/storeEntries';
import { RECOGNITION_TEMPLATE_PATH, type Recognizer, createGeminiRecognizer } from './gemini';
import { NO_RESULT } from './result';

// No test of this file reaches Google. Each recognizer gets a fetch function of the test.

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const template = readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const answer = {
  status: 'identified', productId: 'oat-drink-1l', candidates: [], confidence: 0.9, aimHint: 'none', gesture: 'none',
  code: { visible: false, digits: null },
};

type Call = { url: string; headers: Headers; body: Record<string, unknown> };
let calls: Call[];
let reply: () => Response;

const modelSays = (text: string) => () => new Response(
  JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] }),
  { status: 200, headers: { 'content-type': 'application/json' } },
);

const fetchStub = vi.fn<typeof fetch>(async (input, init) => {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  calls.push({ url: String(input), headers: new Headers(init?.headers), body });
  return reply();
});

const cups: StoreEntry = { item: { gtin: '6438574558384', priceCents: 349, name: 'Paper cups' }, details: null };

function recognizer(over: { mediaResolution?: 'default' | 'low'; storeEntries?: StoreEntry[] } = {}): Recognizer {
  return createGeminiRecognizer({
    apiKey: 'test-key', model: 'gemini-3.5-flash-lite', mediaResolution: over.mediaResolution ?? 'default',
    minConfidence: 0.6, catalog, storeEntries: over.storeEntries ?? [], template, fetch: fetchStub,
  });
}
const opts = (part: { exclude?: string[]; still?: boolean } = {}) =>
  ({ exclude: part.exclude ?? [], still: part.still ?? false, signal: new AbortController().signal });

beforeEach(() => {
  calls = [];
  fetchStub.mockClear();
  reply = modelSays(JSON.stringify(answer));
});

it('sends one frame, the exclude list, the catalog, and the answer schema', async () => {
  expect(await recognizer().recognize(JPEG, opts({ exclude: ['rye-bread'] }))).toEqual(answer);
  expect(calls).toHaveLength(1);
  const { url, headers, body } = calls[0]!;
  expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
  expect(url).not.toContain('test-key');
  expect(headers.get('x-goog-api-key')).toBe('test-key');
  // The API rejects a server deadline below 10 seconds, so the call must send none.
  expect(headers.get('x-server-timeout')).toBeNull();

  const contents = body.contents as { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[];
  expect(contents).toHaveLength(1);
  // One image: recognition by sight makes one call for each frame, so it gets no reference picture.
  expect(contents[0]!.parts).toEqual([
    { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(JPEG).toString('base64') } },
    { text: 'Exclude: rye-bread.' },
  ]);

  const instruction = JSON.stringify(body.systemInstruction);
  for (const product of catalog.products) expect(instruction).toContain(`id: ${product.id} |`);
  expect(instruction).not.toContain('{{catalog}}');

  const config = body.generationConfig as { responseMimeType: string; responseJsonSchema: { properties: { productId: unknown } } };
  expect(config.responseMimeType).toBe('application/json');
  expect(config.responseJsonSchema.properties.productId).toEqual({
    anyOf: [{ type: 'string', enum: catalog.products.map((product) => product.id) }, { type: 'null' }],
  });
  expect(config).not.toHaveProperty('mediaResolution');
  expect(config).not.toHaveProperty('thinkingConfig');
});
it('knows the store items: the instruction lists them, the schema takes their IDs, and an answer with one stays identified', async () => {
  const storeAnswer = { ...answer, productId: 'gtin-6438574558384' };
  reply = modelSays(JSON.stringify(storeAnswer));
  expect(await recognizer().recognize(JPEG, opts())).toMatchObject({ status: 'unknown', productId: null });
  expect(await recognizer({ storeEntries: [cups] }).recognize(JPEG, opts())).toEqual(storeAnswer);

  const { body } = calls[1]!;
  expect(JSON.stringify(body.systemInstruction)).toContain('- id: gtin-6438574558384 | name: Paper cups');
  const config = body.generationConfig as { responseJsonSchema: { properties: { productId: { anyOf: { enum?: string[] }[] } } } };
  expect(config.responseJsonSchema.properties.productId.anyOf[0]!.enum).toEqual([
    ...catalog.products.map((product) => product.id), 'gtin-6438574558384',
  ]);
  // R9: the exclude list also drops a store item.
  expect((await recognizer({ storeEntries: [cups] }).recognize(JPEG, opts({ exclude: ['gtin-6438574558384'] }))).status).toBe('none');
});
it('works with an empty catalog: a store item is still a product, and with no store item each answer names none', async () => {
  const empty = (storeEntries: StoreEntry[]) => createGeminiRecognizer({
    apiKey: 'test-key', model: 'gemini-3.5-flash-lite', mediaResolution: 'default', minConfidence: 0.6,
    catalog: indexCatalog([]), storeEntries, template, fetch: fetchStub,
  });
  reply = modelSays(JSON.stringify({ ...answer, productId: 'gtin-6438574558384' }));
  expect(await empty([cups]).recognize(JPEG, opts())).toMatchObject({ status: 'identified', productId: 'gtin-6438574558384' });
  expect(await empty([]).recognize(JPEG, opts())).toMatchObject({ status: 'unknown', productId: null });
  expect(JSON.stringify(calls[1]!.body.systemInstruction)).toContain('(The catalog is empty.)');
});
it('asks for the low media resolution for a frame, and not for a still', async () => {
  const low = recognizer({ mediaResolution: 'low' });
  await low.recognize(JPEG, opts());
  await low.recognize(JPEG, opts({ still: true }));
  const resolutions = calls.map((call) => (call.body.generationConfig as { mediaResolution?: string }).mediaResolution);
  expect(resolutions).toEqual(['MEDIA_RESOLUTION_LOW', undefined]);
});
it('checks the answer of the model', async () => {
  reply = modelSays(JSON.stringify({ ...answer, confidence: 0.4, aimHint: 'closer' }));
  expect(await recognizer().recognize(JPEG, opts())).toMatchObject({ status: 'unsure', productId: null, aimHint: 'closer' });
  reply = modelSays(JSON.stringify(answer));
  expect((await recognizer().recognize(JPEG, opts({ exclude: ['oat-drink-1l'] }))).status).toBe('none');
});
it('gives no result for an answer that is empty or no JSON', async () => {
  reply = modelSays('');
  expect(await recognizer().recognize(JPEG, opts())).toEqual(NO_RESULT);
  reply = modelSays('The product is an oat drink.');
  expect(await recognizer().recognize(JPEG, opts())).toEqual(NO_RESULT);
});
it('rejects after one attempt when the service fails', async () => {
  reply = () => new Response(JSON.stringify({ error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } }), { status: 503 });
  await expect(recognizer().recognize(JPEG, opts())).rejects.toThrow(/503|overloaded/);
  expect(calls).toHaveLength(1);
});
it('rejects when the caller aborts the call', async () => {
  const abort = new AbortController();
  // As the real fetch does: the call never answers, and it rejects when its signal aborts.
  fetchStub.mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
    const signal = init!.signal!;
    const fail = () => reject(new DOMException('The call was aborted.', 'AbortError'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail);
  }));
  const call = recognizer().recognize(JPEG, { exclude: [], still: false, signal: abort.signal });
  await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  abort.abort();
  await expect(call).rejects.toThrow(/aborted/);
});
