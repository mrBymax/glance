import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { OBSERVE_TEMPLATE_PATH, type Observer, createGeminiObserver } from './gemini';
import { NOT_HELD, parseObservation } from './observation';

// No test of this file reaches Google. Each observer gets a fetch function of the test.

const template = readFileSync(OBSERVE_TEMPLATE_PATH, 'utf8');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const answer = {
  held: true, box: [400, 520, 760, 800], kind: 'can', colors: ['white', 'red'], legible: 'some', brand: 'HELL', name: null,
  variant: 'Zero', size: '250 ml', texts: ['CLASSIC'], digits: ['5 999571 058020'], aimHint: 'none',
};

type Call = { url: string; headers: Headers; body: Record<string, unknown> };
let calls: Call[];
let reply: () => Response;
const modelSays = (text: string) => () => new Response(
  JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] }),
  { status: 200, headers: { 'content-type': 'application/json' } },
);
const fetchStub = vi.fn<typeof fetch>(async (input, init) => {
  calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
  return reply();
});
const observer = (over: { withBox?: boolean; mediaResolution?: 'default' | 'low' } = {}): Observer => createGeminiObserver({
  apiKey: 'test-key', model: 'gemini-3.5-flash-lite', mediaResolution: over.mediaResolution ?? 'default', template,
  withBox: over.withBox ?? true, fetch: fetchStub,
});
const opts = () => ({ signal: new AbortController().signal });

beforeEach(() => {
  calls = [];
  fetchStub.mockClear();
  reply = modelSays(JSON.stringify(answer));
});

it('sends the frame alone, with an instruction that holds no store item, and the answer schema', async () => {
  expect(await observer().observe(JPEG, opts())).toEqual({ ...answer, digits: ['5999571058020'] });
  expect(calls).toHaveLength(1);
  const { url, headers, body } = calls[0]!;
  expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
  expect(headers.get('x-goog-api-key')).toBe('test-key');
  // The API rejects a server deadline below 10 seconds, so the call must send none.
  expect(headers.get('x-server-timeout')).toBeNull();
  const contents = body.contents as { parts: unknown[] }[];
  expect(contents).toHaveLength(1);
  expect(contents[0]!.parts).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: Buffer.from(JPEG).toString('base64') } }]);

  const instruction = JSON.stringify(body.systemInstruction);
  expect(instruction).toContain('You do not know the store.');
  expect(instruction).not.toMatch(/gtin-|\d{13}|\{\{/);
  const config = body.generationConfig as { responseMimeType: string; responseJsonSchema: { properties: Record<string, unknown>; required: string[] }; mediaResolution?: string };
  expect(config.responseMimeType).toBe('application/json');
  // `held` is the first field: the model decides where the product is before it describes it.
  expect(Object.keys(config.responseJsonSchema.properties)).toEqual([
    'held', 'box', 'kind', 'colors', 'legible', 'brand', 'name', 'variant', 'size', 'texts', 'digits', 'aimHint',
  ]);
  expect(config.mediaResolution).toBeUndefined();
  expect(body.tools).toBeUndefined();
});
it('asks for no box when the caller needs none', async () => {
  await observer({ withBox: false }).observe(JPEG, opts());
  const { body } = calls[0]!;
  const config = body.generationConfig as { responseJsonSchema: { properties: Record<string, unknown> } };
  expect(Object.keys(config.responseJsonSchema.properties)).not.toContain('box');
  expect(JSON.stringify(body.systemInstruction)).not.toContain('`box`');
  await observer().observe(JPEG, opts());
  expect(JSON.stringify(calls[1]!.body.systemInstruction)).toContain('`box`');
});
it('asks for the low media resolution when the setting says so', async () => {
  await observer({ mediaResolution: 'low' }).observe(JPEG, opts());
  expect((calls[0]!.body.generationConfig as { mediaResolution: string }).mediaResolution).toBe('MEDIA_RESOLUTION_LOW');
});
it('makes one attempt, and rejects when the service fails', async () => {
  reply = () => new Response('{"error":{"code":503,"message":"busy","status":"UNAVAILABLE"}}', { status: 503, headers: { 'content-type': 'application/json' } });
  await expect(observer().observe(JPEG, opts())).rejects.toThrow();
  expect(calls).toHaveLength(1);
});
it('reads an answer that is no JSON as a frame with no product', async () => {
  reply = modelSays('I see a can.');
  expect(await observer().observe(JPEG, opts())).toEqual(NOT_HELD);
});

it('an answer with held false loses each other field', () => {
  expect(parseObservation({ ...answer, held: false })).toEqual(NOT_HELD);
  expect(parseObservation({ kind: 'can' })).toEqual(NOT_HELD);
  expect(parseObservation('can')).toEqual(NOT_HELD);
});
it('reads each field alone: a bad field counts as not read, and the other fields stay', () => {
  const seen = parseObservation({ held: true, kind: 7, colors: 'red', legible: 'sharp', brand: ' Kili ', name: 'unknown', variant: '', size: null, texts: ['  a  b ', 3, 'N/A'], digits: ['64300627 61764', '12', 'abc'], aimHint: 'spin' });
  expect(seen).toEqual({
    held: true, box: null, kind: null, colors: [], legible: 'none', brand: 'Kili', name: null, variant: null, size: null,
    texts: [], digits: ['6430062761764'], aimHint: 'none',
  });
  expect(parseObservation({ ...answer, texts: ['  a  b ', 'N/A'] }).texts).toEqual(['a b']);
});
it('keeps a box inside the frame, and drops a box with no area', () => {
  expect(parseObservation({ ...answer, box: [-5, 10.4, 1200, 900] }).box).toEqual([0, 10, 1000, 900]);
  expect(parseObservation({ ...answer, box: [500, 500, 500, 900] }).box).toBeNull();
  expect(parseObservation({ ...answer, box: [1, 2, 3] }).box).toBeNull();
  expect(parseObservation({ ...answer, box: undefined }).box).toBeNull();
});
