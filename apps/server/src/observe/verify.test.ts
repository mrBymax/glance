import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import type { StoreEntry } from '../products/storeEntries';
import { createProductSearch } from '../search/productSearch';
import { MAX_TOOL_ROUNDS, VERIFY_TEMPLATE_PATH, type Verifier, createGeminiVerifier, describeItem, runVerifyFunction } from './verify';

// No test of this file reaches Google. Each verifier gets a fetch function of the test.

const template = readFileSync(VERIFY_TEMPLATE_PATH, 'utf8');
const FRAME_A = new Uint8Array([0xff, 0xd8, 1]);
const FRAME_B = new Uint8Array([0xff, 0xd8, 2]);
const PICTURE = new Uint8Array([0xff, 0xd8, 9]);
const VADELMA = '6430062761764';
const CUPS = '6416453073494';
const NO_DETAILS = { brand: null, quantity: null, allergens: null, vegan: null, vegetarian: null };
const entries: StoreEntry[] = [
  { item: { gtin: VADELMA, priceCents: 249, name: 'Kili Cascara Vadelma', brand: 'Kili', packSize: '330 ml' }, details: null },
  { item: { gtin: '6430062761795', priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' }, details: null },
  { item: { gtin: CUPS, priceCents: 199, name: 'Paper cups' }, details: { ...NO_DETAILS, quantity: '50 pcs', texts: { names: ['Kartonkipikari', 'Pappersmugg', 'paper cups'], brands: ['Pirkka'], keywords: [] } } },
];
const search = createProductSearch(entries);
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[];
let replies: object[];
const says = (parts: object[]) => ({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] });
const text = (answer: object) => says([{ text: JSON.stringify(answer) }]);
const fetchStub = vi.fn<typeof fetch>(async (input, init) => {
  calls.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
  return new Response(JSON.stringify(replies.shift() ?? text({ gtin: null, confidence: 0, seen: 'none', reason: '' })), { status: 200, headers: { 'content-type': 'application/json' } });
});
const verifier = (): Verifier => createGeminiVerifier({ apiKey: 'test-key', model: 'gemini-3.5-flash-lite', template, search, fetch: fetchStub });
const input = { frames: [FRAME_A, FRAME_B], candidates: [{ entry: entries[0]!, pictures: [PICTURE] }, { entry: entries[2]!, pictures: [] }], seen: '{"kind":"can"}' };
const opts = () => ({ signal: new AbortController().signal });

beforeEach(() => {
  calls = [];
  replies = [];
  fetchStub.mockClear();
});

it('sends the candidates with their pictures, then the frames, the two functions, and the answer schema', async () => {
  replies = [text({ gtin: VADELMA, confidence: 0.95, seen: 'text', reason: 'The can says VADELMA.' })];
  expect(await verifier().verify(input, opts())).toEqual({ gtin: VADELMA, confidence: 0.95, seen: 'text', reason: 'The can says VADELMA.', calls: 1, lookups: 0 });
  expect(calls).toHaveLength(1);
  const { url, body } = calls[0]!;
  expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
  const contents = body.contents as { role: string; parts: unknown[] }[];
  expect(contents).toHaveLength(1);
  expect(contents[0]!.parts).toEqual([
    { text: `Candidate ${VADELMA}: Kili Cascara Vadelma | brand: Kili | pack: 330 ml` },
    // A reference picture has the low media resolution of its part. A frame keeps the default.
    { inlineData: { mimeType: 'image/jpeg', data: b64(PICTURE) }, mediaResolution: { level: 'MEDIA_RESOLUTION_LOW' } },
    { text: `Candidate ${CUPS}: Paper cups | pack: 50 pcs | also named: Kartonkipikari, Pappersmugg` },
    { text: 'Frames of the held product, oldest first' },
    { inlineData: { mimeType: 'image/jpeg', data: b64(FRAME_A) } },
    { inlineData: { mimeType: 'image/jpeg', data: b64(FRAME_B) } },
    { text: 'A first reader saw in these frames: {"kind":"can"}\nWhich of the candidates, if any, is the held product?' },
  ]);
  // No price: the model selects an item, and the store list has its price.
  expect(JSON.stringify(body)).not.toMatch(/priceCents|249/);

  const tools = body.tools as { functionDeclarations: { name: string; parametersJsonSchema: { required: string[] } }[] }[];
  expect(tools[0]!.functionDeclarations.map((declaration) => declaration.name)).toEqual(['search_products', 'get_product']);
  expect(tools[0]!.functionDeclarations.map((declaration) => declaration.parametersJsonSchema.required)).toEqual([['query'], ['gtin']]);
  const config = body.generationConfig as { responseMimeType: string; responseJsonSchema: { required: string[] } };
  expect(config.responseMimeType).toBe('application/json');
  expect(config.responseJsonSchema.required).toEqual(['gtin', 'confidence', 'seen', 'reason']);
  expect(body.toolConfig).toBeUndefined();
  expect(JSON.stringify(body.systemInstruction)).toContain('which of the candidates, if any, is the held product?');
});
it('runs a search of the model on the store, and sends the model content back as it came', async () => {
  const asked = { functionCall: { id: 'call-1', name: 'search_products', args: { query: 'pappersmugg', limit: 3 } }, thoughtSignature: 'c2lnbmF0dXJl' };
  replies = [says([asked]), text({ gtin: CUPS, confidence: 0.9, seen: 'text', reason: 'The pack says Pappersmugg.' })];
  const none = { ...input, candidates: [] };
  expect(await verifier().verify(none, opts())).toMatchObject({ gtin: CUPS, calls: 2, lookups: 1 });
  expect(calls).toHaveLength(2);
  const first = calls[0]!.body.contents as { parts: { text?: string }[] }[];
  expect(first[0]!.parts[0]).toEqual({ text: 'The search gave no candidate. Search the store with the words that you read.' });
  const contents = calls[1]!.body.contents as { role: string; parts: Record<string, unknown>[] }[];
  expect(contents).toHaveLength(3);
  // A Gemini 3 model needs the thought signature of its function call back.
  expect(contents[1]).toEqual({ role: 'model', parts: [asked] });
  expect(contents[2]!.role).toBe('user');
  expect(contents[2]!.parts).toEqual([{
    functionResponse: {
      id: 'call-1', name: 'search_products',
      response: { items: [{ gtin: CUPS, name: 'Paper cups', packSize: '50 pcs', otherNames: ['Kartonkipikari', 'Pappersmugg'], score: 1, matched: ['name: pappersmugg'] }] },
    },
  }]);
});
it('takes an item that a search of the call returned, and no other code', async () => {
  const ask = (args: object) => says([{ functionCall: { name: 'search_products', args } }]);
  replies = [ask({ query: 'yuzu', brand: 'kili' }), text({ gtin: '6430062761795', confidence: 0.9, seen: 'text', reason: 'YUZU' })];
  expect(await verifier().verify({ ...input, candidates: [] }, opts())).toMatchObject({ gtin: '6430062761795', seen: 'text' });
  replies = [text({ gtin: '6430062761795', confidence: 0.9, seen: 'text', reason: 'YUZU' })];
  expect(await verifier().verify(input, opts())).toEqual({ gtin: null, confidence: 0, seen: 'none', reason: 'YUZU', calls: 1, lookups: 0 });
  replies = [text({ gtin: '4006381333931', confidence: 1, seen: 'text', reason: 'made up' })];
  expect((await verifier().verify(input, opts())).gtin).toBeNull();
});
it(`allows ${MAX_TOOL_ROUNDS} rounds of functions, and then asks for the answer with no function`, async () => {
  const ask = () => says([{ functionCall: { name: 'get_product', args: { gtin: VADELMA } } }]);
  replies = [ask(), ask(), text({ gtin: VADELMA, confidence: 0.9, seen: 'look', reason: 'pink logo' })];
  expect(await verifier().verify(input, opts())).toMatchObject({ gtin: VADELMA, seen: 'look', calls: 3, lookups: 2 });
  expect(calls.map((call) => (call.body.toolConfig as { functionCallingConfig: { mode: string } } | undefined)?.functionCallingConfig.mode)).toEqual([undefined, undefined, 'NONE']);
  replies = [ask(), ask(), ask()];
  expect(await verifier().verify(input, opts())).toMatchObject({ gtin: null, calls: 3, lookups: 2 });
});
it('answers each function call of one turn', async () => {
  replies = [
    says([{ functionCall: { id: 'a', name: 'get_product', args: { gtin: VADELMA } } }, { functionCall: { id: 'b', name: 'get_product', args: { gtin: '1' } } }]),
    text({ gtin: null, confidence: 0.8, seen: 'none', reason: 'blurred' }),
  ];
  expect(await verifier().verify(input, opts())).toMatchObject({ gtin: null, confidence: 0.8, lookups: 2 });
  const parts = (calls[1]!.body.contents as { parts: { functionResponse: { id: string; response: object } }[] }[])[2]!.parts;
  expect(parts.map((part) => part.functionResponse.id)).toEqual(['a', 'b']);
  expect(parts[1]!.functionResponse.response).toEqual({ error: 'The store has no item with this code.' });
});
it('reads an answer that is no JSON, or that fails the schema, as no item', async () => {
  replies = [says([{ text: 'It is the pink one.' }])];
  expect(await verifier().verify(input, opts())).toEqual({ gtin: null, confidence: 0, seen: 'none', reason: '', calls: 1, lookups: 0 });
  replies = [text({ gtin: VADELMA, confidence: 7 })];
  expect((await verifier().verify(input, opts())).gtin).toBeNull();
});
it('an answer with no item has seen none', async () => {
  replies = [text({ gtin: null, confidence: 0.9, seen: 'text', reason: 'no item fits' })];
  expect(await verifier().verify(input, opts())).toMatchObject({ gtin: null, seen: 'none', confidence: 0.9 });
});
it('rejects when the service fails', async () => {
  fetchStub.mockResolvedValueOnce(new Response('{"error":{"code":500,"message":"down","status":"INTERNAL"}}', { status: 500, headers: { 'content-type': 'application/json' } }));
  await expect(verifier().verify(input, opts())).rejects.toThrow();
  expect(fetchStub).toHaveBeenCalledTimes(1);
});

it('the search function gives the items with their scores, and limits the number', async () => {
  const { response, gtins } = await runVerifyFunction(search, 'search_products', { query: 'cascara', brand: 'Kili', limit: 1 });
  expect(gtins).toEqual([VADELMA]);
  expect(response).toEqual({ items: [{ ...describeItem(entries[0]!), score: 1, matched: ['brand: kili', 'name: cascara'] }] });
  expect((await runVerifyFunction(search, 'search_products', { query: 'cascara', limit: 99 })).gtins).toHaveLength(2);
  expect(await runVerifyFunction(search, 'search_products', { query: 'oat drink' })).toEqual({ response: { items: [] }, gtins: [] });
  expect(await runVerifyFunction(search, 'search_products', {})).toEqual({ response: { items: [] }, gtins: [] });
});
it('the product function reads a code with spaces, and a code of 8 digits', async () => {
  expect((await runVerifyFunction(search, 'get_product', { gtin: '6 430062 761764' })).gtins).toEqual([VADELMA]);
  expect(await runVerifyFunction(search, 'get_product', { gtin: 12 })).toEqual({ response: { error: 'The store has no item with this code.' }, gtins: [] });
});
it('a function that the server does not have gives an error text', async () => {
  expect(await runVerifyFunction(search, 'delete_product', {})).toEqual({ response: { error: 'No function has the name delete_product.' }, gtins: [] });
});
