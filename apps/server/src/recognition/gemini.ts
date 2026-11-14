import { GoogleGenAI, MediaResolution } from '@google/genai';
import { type CatalogIndex, indexCatalog } from '../catalog/catalog';
import { scannedProduct } from '../products/scanned';
import type { StoreEntry } from '../products/storeEntries';
import { buildSystemInstruction, recognitionResponseSchema, userText } from './prompt';
import { NO_RESULT, type RecognitionResult, normalizeResult } from './result';

/** Names the product of one frame. A call that fails rejects, and the caller counts it. */
export interface Recognizer {
  recognize(jpeg: Uint8Array, opts: { exclude: readonly string[]; still: boolean; signal: AbortSignal }): Promise<RecognitionResult>;
}

/** The path of the instruction template, from the working directory apps/server. */
export const RECOGNITION_TEMPLATE_PATH = '../../agents/recognition.md';

/**
 * One generateContent call for each frame, with no state between the calls.
 * The call shape matches the type definitions of @google/genai 3.3.0.
 */
export function createGeminiRecognizer(deps: {
  apiKey: string; model: string; mediaResolution: 'default' | 'low'; minConfidence: number;
  catalog: CatalogIndex; template: string;
  /**
   * The store items that the catalog does not hold, as they were at the start of the server. The model can name each one
   * by the ID of a scanned product. A script that tests the catalog alone gives an empty list.
   */
  storeEntries: readonly StoreEntry[];
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): Recognizer {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const systemInstruction = buildSystemInstruction(deps.template, deps.catalog.products, deps.storeEntries);
  // Each product that the model can name. The check of an answer needs only the IDs.
  const known = indexCatalog([
    ...deps.catalog.products, ...deps.storeEntries.map((entry) => scannedProduct(entry.item, entry.details)),
  ]);
  const responseSchema = recognitionResponseSchema(known.products.map((product) => product.id));

  return {
    async recognize(jpeg, opts) {
      // A still is the sharp second look at a package, so it keeps the default resolution.
      const low = deps.mediaResolution === 'low' && !opts.still;
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: Buffer.from(jpeg).toString('base64') } },
          { text: userText(opts.exclude) },
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          abortSignal: opts.signal,
          // The SDK default is 5 attempts with a wait between them. One glance has 4 seconds, so one attempt is all it gets.
          // No `timeout` here: the SDK sends it as the header X-Server-Timeout, and the API rejects a deadline
          // below 10 seconds with status 400. The signal of the caller ends the call after 4 seconds.
          httpOptions: { retryOptions: { attempts: 1 } },
          ...(low ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
        },
      });

      let raw: unknown;
      try {
        raw = JSON.parse(response.text ?? '');
      } catch {
        return NO_RESULT;
      }
      return normalizeResult(raw, { catalog: known, exclude: opts.exclude, minConfidence: deps.minConfidence });
    },
  };
}
