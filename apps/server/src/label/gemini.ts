import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { type LabelReader, NO_LABEL, parseLabelAnswer } from './reader';

/** The path of the instruction file, from the working directory apps/server. */
export const LABEL_TEMPLATE_PATH = '../../agents/label.md';

/** The JSON Schema of the answer. It holds no product ID: the server matches the answer against the store list. */
export function labelResponseSchema(): unknown {
  return z.toJSONSchema(z.object({
    digits: z.array(z.string()),
    brand: z.string().nullable(),
    name: z.string().nullable(),
    packSize: z.string().nullable(),
    confidence: z.number().min(0).max(1),
  }));
}

/**
 * One generateContent call for each still of a label, with no state between the calls.
 * The call shape matches the type definitions of @google/genai 3.3.0, as the recognition call does.
 * The still keeps the default media resolution, because the digits under a barcode are small.
 */
export function createGeminiLabelReader(deps: {
  apiKey: string; model: string;
  /** The system instruction of agents/label.md. */
  template: string;
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): LabelReader {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const responseSchema = labelResponseSchema();

  return {
    async read(jpeg, opts) {
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') } },
          { text: 'Read this label.' },
        ],
        config: {
          systemInstruction: deps.template,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          abortSignal: opts.signal,
          // One attempt, and no `timeout`: the API rejects a server deadline below 10 seconds (see recognition/gemini.ts).
          httpOptions: { retryOptions: { attempts: 1 } },
        },
      });

      let raw: unknown;
      try {
        raw = JSON.parse(response.text ?? '');
      } catch {
        return NO_LABEL;
      }
      return parseLabelAnswer(raw);
    },
  };
}
