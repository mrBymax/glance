import { GoogleGenAI } from '@google/genai';
import { ASK_TIMEOUT_MS, type Generate } from './ask';

/**
 * The text call for a question: one generateContent call with a system instruction and no response schema.
 * The call shape matches the type definitions of @google/genai 3.3.0, as the recognition call does.
 */
export function createGeminiGenerate(deps: {
  apiKey: string; model: string;
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): Generate {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });

  return async (systemInstruction, text) => {
    const response = await ai.models.generateContent({
      model: deps.model,
      contents: [{ text }],
      config: {
        systemInstruction,
        // The runtime stops its wait after this time, so the call must end then too.
        abortSignal: AbortSignal.timeout(ASK_TIMEOUT_MS),
        // One attempt, and no `timeout`: the API rejects a server deadline below 10 seconds (see recognition/gemini.ts).
        httpOptions: { retryOptions: { attempts: 1 } },
      },
    });
    return response.text ?? '';
  };
}
