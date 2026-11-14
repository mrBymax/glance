import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { LABEL_TEMPLATE_PATH, createGeminiLabelReader, labelResponseSchema } from './gemini';
import { type LabelReader, NO_LABEL } from './reader';

// No test of this file reaches Google. Each reader gets a fetch function of the test.

const template = readFileSync(LABEL_TEMPLATE_PATH, 'utf8');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const answer = { digits: ['8076800195057'], brand: 'Barilla', name: 'Spaghetti n.5', packSize: '500 g', confidence: 0.9 };

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

const reader = (): LabelReader => createGeminiLabelReader({ apiKey: 'test-key', model: 'gemini-3.5-flash-lite', template, fetch: fetchStub });
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
  expect(JSON.stringify(body.systemInstruction)).toContain('Never guess a digit');

  const config = body.generationConfig as { responseMimeType: string; responseJsonSchema: unknown };
  expect(config.responseMimeType).toBe('application/json');
  expect(config.responseJsonSchema).toEqual(labelResponseSchema());
  // A still keeps the default media resolution: the digits are small.
  expect(config).not.toHaveProperty('mediaResolution');
});
it('asks for digits, brand, name, pack size, and confidence', () => {
  const schema = labelResponseSchema() as { required: string[]; properties: Record<string, { type?: unknown; items?: unknown }> };
  expect(schema.required).toEqual(['digits', 'brand', 'name', 'packSize', 'confidence']);
  expect(schema.properties.digits).toMatchObject({ type: 'array', items: { type: 'string' } });
});
it('the instruction file names each field and the rule for the digits', () => {
  for (const word of ['digits', 'brand', 'name', 'packSize', 'confidence', 'Never guess a digit']) expect(template).toContain(word);
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
