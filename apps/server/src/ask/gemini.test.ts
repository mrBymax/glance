import { expect, it, vi } from 'vitest';
import { createGeminiGenerate } from './gemini';

// No test of this file reaches Google. The generate function gets a fetch function of the test.

type Call = { url: string; headers: Headers; body: Record<string, unknown> };

function stub(reply: () => Response): { calls: Call[]; fetch: typeof fetch } {
  const calls: Call[] = [];
  const fetchStub = vi.fn<typeof fetch>(async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return reply();
  });
  return { calls, fetch: fetchStub };
}

const modelSays = (text: string) => () => new Response(
  JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] }),
  { status: 200, headers: { 'content-type': 'application/json' } },
);

it('makes one text call with the system instruction and no response schema', async () => {
  const { calls, fetch } = stub(modelSays('It contains gluten.'));
  const generate = createGeminiGenerate({ apiKey: 'test-key', model: 'gemini-3.5-flash-lite', fetch });
  expect(await generate('RULES', 'Question: q')).toBe('It contains gluten.');
  expect(calls).toHaveLength(1);
  const { url, headers, body } = calls[0]!;
  expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
  expect(url).not.toContain('test-key');
  expect(headers.get('x-goog-api-key')).toBe('test-key');
  expect(headers.get('x-server-timeout')).toBeNull();
  expect((body.contents as { parts: { text: string }[] }[])[0]!.parts).toEqual([{ text: 'Question: q' }]);
  expect(JSON.stringify(body.systemInstruction)).toContain('RULES');
  const config = (body.generationConfig ?? {}) as Record<string, unknown>;
  expect(config.responseMimeType).toBeUndefined();
  expect(config.responseJsonSchema).toBeUndefined();
});
it('rejects when the service answers with an error, after one attempt', async () => {
  const { calls, fetch } = stub(() => new Response('{"error":{"code":503,"message":"busy","status":"UNAVAILABLE"}}', { status: 503 }));
  const generate = createGeminiGenerate({ apiKey: 'test-key', model: 'gemini-3.5-flash-lite', fetch });
  await expect(generate('RULES', 'q')).rejects.toThrow();
  expect(calls).toHaveLength(1);
});
