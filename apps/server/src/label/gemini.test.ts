import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import type { StoreEntry } from '../products/storeEntries';
import { LABEL_TEMPLATE_PATH, buildLabelInstruction, createGeminiLabelReader, labelResponseSchema } from './gemini';
import { type LabelReader, NO_LABEL } from './reader';

// No test of this file reaches Google. Each reader gets a fetch function of the test.

const template = readFileSync(LABEL_TEMPLATE_PATH, 'utf8');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const answer = {
  digits: ['8076800195057'], brand: 'Barilla', name: 'Spaghetti n.5', packSize: '500 g', confidence: 0.9,
  item: '8076800195057', itemConfidence: 0.9,
};
const entries: StoreEntry[] = [
  { item: { gtin: '8076800195057', priceCents: 109, name: 'Spaghetti n.5', brand: 'Barilla', packSize: '500 g' }, details: null },
  { item: { gtin: '6438574558384', priceCents: 349, name: 'Paper cups' }, details: null },
  {
    item: { gtin: '7312220096019', priceCents: 279, name: 'Biscoff' },
    details: { brand: 'Lotus', quantity: '250 g', allergens: ['gluten', 'soy'], vegan: true, vegetarian: true },
  },
];
const GTINS = entries.map((entry) => entry.item.gtin);

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

const reader = (): LabelReader => createGeminiLabelReader({
  apiKey: 'test-key', model: 'gemini-3.5-flash-lite', template, entries, fetch: fetchStub,
});
const signal = () => new AbortController().signal;

beforeEach(() => {
  calls = [];
  fetchStub.mockClear();
  reply = modelSays(JSON.stringify(answer));
});

it('sends one still with the label instruction and the answer schema', async () => {
  expect(await reader().read(JPEG, { signal: signal() })).toEqual(answer);
  expect(calls).toHaveLength(1);
  const { url, headers, body } = calls[0]!;
  expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
  expect(url).not.toContain('test-key');
  expect(headers.get('x-goog-api-key')).toBe('test-key');
  expect(headers.get('x-server-timeout')).toBeNull();

  const contents = body.contents as { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[];
  expect(contents).toHaveLength(1);
  expect(contents[0]!.parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: Buffer.from(JPEG).toString('base64') } });
  const instruction = JSON.stringify(body.systemInstruction);
  expect(instruction).toContain('Never guess a digit');
  expect(instruction).toContain('- gtin: 6438574558384 | name: Paper cups');
  expect(instruction).not.toContain('{{storeList}}');

  const config = body.generationConfig as { responseMimeType: string; responseJsonSchema: unknown };
  expect(config.responseMimeType).toBe('application/json');
  expect(config.responseJsonSchema).toEqual(labelResponseSchema(GTINS));
  // A still keeps the default media resolution: the digits are small.
  expect(config).not.toHaveProperty('mediaResolution');
});
it('sends each reference picture before the still, with its item in a text part and the low media resolution', async () => {
  const front = new Uint8Array([0xff, 0xd8, 1, 0xff, 0xd9]);
  const back = new Uint8Array([0xff, 0xd8, 2, 0xff, 0xd9]);
  const references = [
    { gtin: '6438574558384', name: 'Paper cups', jpeg: front },
    { gtin: '6438574558384', name: 'Paper cups', jpeg: back },
    { gtin: '7312220096019', name: 'Biscoff', jpeg: front },
  ];
  await reader().read(JPEG, { signal: signal(), references });
  const contents = calls[0]!.body.contents as { parts: unknown[] }[];
  expect(contents).toHaveLength(1);
  const picture = (jpeg: Uint8Array) => ({
    inlineData: { mimeType: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') },
    mediaResolution: { level: 'MEDIA_RESOLUTION_LOW' },
  });
  expect(contents[0]!.parts).toEqual([
    { text: 'Reference picture of item 6438574558384: Paper cups' }, picture(front),
    { text: 'Reference picture of item 6438574558384: Paper cups' }, picture(back),
    { text: 'Reference picture of item 7312220096019: Biscoff' }, picture(front),
    { text: 'The photo to read' },
    // The still keeps the default media resolution: the digits are small.
    { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(JPEG).toString('base64') } },
  ]);
  expect(calls[0]!.body.generationConfig).not.toHaveProperty('mediaResolution');
});
it('with no reference picture the request is the still and one text part', async () => {
  for (const opts of [{ signal: signal() }, { signal: signal(), references: [] }]) {
    calls = [];
    await reader().read(JPEG, opts);
    const contents = calls[0]!.body.contents as { parts: unknown[] }[];
    expect(contents[0]!.parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(JPEG).toString('base64') } },
      { text: 'Read this label.' },
    ]);
  }
});
it('the instruction file says how to use the reference pictures', () => {
  expect(template).toMatch(/Reference picture of item/);
  expect(template).toMatch(/another side/);
  expect(template).toMatch(/other light/);
  expect(template).toMatch(/background of a reference picture means nothing/);
  expect(template).toMatch(/same product as a reference picture/);
});
type Schema = { required: string[]; properties: Record<string, { type?: unknown; items?: unknown; anyOf?: unknown[]; minimum?: number; maximum?: number }> };

it('asks for digits, brand, name, pack size, confidence, and one item of the store list with its own confidence', () => {
  const schema = labelResponseSchema(GTINS) as Schema;
  expect(schema.required).toEqual(['digits', 'brand', 'name', 'packSize', 'confidence', 'item', 'itemConfidence']);
  expect(schema.properties.digits).toMatchObject({ type: 'array', items: { type: 'string' } });
  expect(schema.properties.item!.anyOf).toEqual([{ type: 'string', enum: GTINS }, { type: 'null' }]);
  expect(schema.properties.itemConfidence).toMatchObject({ type: 'number', minimum: 0, maximum: 1 });
});
it('with an empty store list the item of the answer can only be null', () => {
  expect((labelResponseSchema([]) as Schema).properties.item).toEqual({ type: 'null' });
  expect(buildLabelInstruction('List:\n{{storeList}}', [])).toBe('List:\n(The store list is empty.)');
});
it('writes one line for each store item, with the brand and the pack size of the database when the list has none', () => {
  expect(buildLabelInstruction('List:\n{{storeList}}\nEnd.', entries).split('\n')).toEqual([
    'List:',
    '- gtin: 8076800195057 | name: Spaghetti n.5 | brand: Barilla | pack: 500 g',
    '- gtin: 6438574558384 | name: Paper cups',
    '- gtin: 7312220096019 | name: Biscoff | brand: Lotus | pack: 250 g',
    'End.',
  ]);
  // The model selects an item, and the price comes from the store list.
  expect(buildLabelInstruction('{{storeList}}', entries)).not.toContain('349');
});
it('rejects a template with no placeholder for the store list', () => {
  expect(() => buildLabelInstruction('Rules.', entries)).toThrow(/\{\{storeList\}\}/);
});
it('the instruction file names each field, the rule for the digits, and the rules for the item', () => {
  for (const word of ['digits', 'brand', 'name', 'packSize', 'confidence', 'item', 'itemConfidence', 'Never guess a digit', '{{storeList}}']) {
    expect(template).toContain(word);
  }
  // The package of the first test with the glasses: Finnish and Swedish print, an English name in the list.
  expect(template).toContain('"Kartonkipikari / Pappersmugg" is "Paper cups"');
  expect(template).toMatch(/another language/);
  expect(template).toMatch(/not a similar one/);
  expect(template).not.toContain('{{catalog}}');
});
it('gives an empty answer for a text that is empty, no JSON, or no label', async () => {
  for (const text of ['', 'The label says Barilla.', '{"digits":"8076800195057"}']) {
    reply = modelSays(text);
    expect(await reader().read(JPEG, { signal: signal() })).toEqual(NO_LABEL);
  }
});
it('rejects after one attempt when the service fails', async () => {
  reply = () => new Response(JSON.stringify({ error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } }), { status: 503 });
  await expect(reader().read(JPEG, { signal: signal() })).rejects.toThrow(/503|overloaded/);
  expect(calls).toHaveLength(1);
});
it('rejects when the caller aborts the call', async () => {
  const abort = new AbortController();
  // As the real fetch does: the call never answers, and it rejects when its signal aborts.
  fetchStub.mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
    const fail = () => reject(new DOMException('The call was aborted.', 'AbortError'));
    if (init!.signal!.aborted) fail();
    else init!.signal!.addEventListener('abort', fail);
  }));
  const call = reader().read(JPEG, { signal: abort.signal });
  await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  abort.abort();
  await expect(call).rejects.toThrow(/aborted/);
});
