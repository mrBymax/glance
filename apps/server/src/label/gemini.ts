import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { StoreEntry } from '../products/storeEntries';
import { type LabelReader, NO_LABEL, parseLabelAnswer } from './reader';

/** The path of the instruction file, from the working directory apps/server. */
export const LABEL_TEMPLATE_PATH = '../../agents/label.md';

const STORE_LIST_PLACEHOLDER = '{{storeList}}';

/**
 * Puts the store list into the instruction template, one line for each item.
 * The brand and the pack size come from the store list, else from the details of the product database.
 * The line holds no price: the model selects an item, and the price comes from the store list.
 */
export function buildLabelInstruction(template: string, entries: readonly StoreEntry[]): string {
  if (!template.includes(STORE_LIST_PLACEHOLDER)) {
    throw new Error(`The label instruction has no ${STORE_LIST_PLACEHOLDER} placeholder.`);
  }
  const lines = entries.map(({ item, details }) => {
    const brand = item.brand ?? details?.brand ?? null;
    const pack = item.packSize ?? details?.quantity ?? null;
    return `- gtin: ${item.gtin} | name: ${item.name}${brand === null ? '' : ` | brand: ${brand}`}${pack === null ? '' : ` | pack: ${pack}`}`;
  });
  // A function as the replacement keeps a "$" of an item text as it is.
  return template.replace(STORE_LIST_PLACEHOLDER, () => (lines.length > 0 ? lines.join('\n') : '(The store list is empty.)'));
}

/**
 * The JSON Schema of the answer. `item` takes only a code of the store list, so the model cannot write a code outside it.
 * The server still checks each field of the answer against the store list.
 */
export function labelResponseSchema(gtins: readonly string[]): unknown {
  return z.toJSONSchema(z.object({
    digits: z.array(z.string()),
    brand: z.string().nullable(),
    name: z.string().nullable(),
    packSize: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    item: gtins.length > 0 ? z.enum(gtins as [string, ...string[]]).nullable() : z.null(),
    itemConfidence: z.number().min(0).max(1),
  }));
}

/**
 * One generateContent call for each still of a label, with no state between the calls.
 * The call shape matches the type definitions of @google/genai 3.3.0, as the recognition call does.
 * The still keeps the default media resolution, because the digits under a barcode are small.
 * The store list can change the size of the instruction, so the reader builds the instruction and the schema one time.
 */
export function createGeminiLabelReader(deps: {
  apiKey: string; model: string;
  /** The text of agents/label.md, with the placeholder for the store list. */
  template: string;
  /** The store list as it was at the start of the server. */
  entries: readonly StoreEntry[];
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): LabelReader {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const systemInstruction = buildLabelInstruction(deps.template, deps.entries);
  const responseSchema = labelResponseSchema(deps.entries.map((entry) => entry.item.gtin));

  return {
    async read(jpeg, opts) {
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') } },
          { text: 'Read this label.' },
        ],
        config: {
          systemInstruction,
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
