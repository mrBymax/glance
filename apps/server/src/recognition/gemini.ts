import { GoogleGenAI, MediaResolution, type Part } from '@google/genai';
import type { FrameHeader } from '@glance/shared';
import { type CatalogIndex, indexCatalog } from '../catalog/catalog';
import { jpegPart, referencePicturePart } from '../label/gemini';
import { scannedProduct } from '../products/scanned';
import type { StoreEntry } from '../products/storeEntries';
import { buildSystemInstruction, recognitionResponseSchema, userText } from './prompt';
import { NO_RESULT, type RecognitionResult, normalizeResult } from './result';

/**
 * Names the product of one frame. A call that fails rejects, and the caller counts it.
 * `view` is the view of the frame header: `crop` for a crop of the phone around an object that it found.
 * `context` is the context image of a crop: the whole frame in a small size.
 */
export interface Recognizer {
  recognize(jpeg: Uint8Array, opts: {
    exclude: readonly string[]; still: boolean; signal: AbortSignal; view?: FrameHeader['view']; context?: Uint8Array;
  }): Promise<RecognitionResult>;
}

/** The path of the instruction template, from the working directory apps/server. */
export const RECOGNITION_TEMPLATE_PATH = '../../agents/recognition.md';

/**
 * The parts of the image of a crop that came with its context: the whole frame in a small size, then the crop.
 * The whole frame has the low media resolution of its part (280 tokens): the model finds the hand in it and
 * reads nothing. The two texts are those of "The image" in the instruction.
 */
export function cropWithContextParts(crop: Uint8Array, context: Uint8Array): Part[] {
  return [{ text: 'The whole frame' }, referencePicturePart(context), { text: 'The crop' }, jpegPart(crop)];
}

/**
 * The parts of one request: the frame and the exclude line. With reference pictures, their parts come first,
 * and the frame follows the text "The frame", so the model can tell the frame from a picture.
 * A crop with a context image goes out as two images: see `cropWithContextParts`.
 */
export function recognitionParts(
  jpeg: Uint8Array, exclude: readonly string[], references: readonly Part[], view?: FrameHeader['view'], context?: Uint8Array,
): Part[] {
  const text = { text: userText(exclude, view) };
  if (view === 'crop' && context !== undefined) return [...references, ...cropWithContextParts(jpeg, context), text];
  const frame = [jpegPart(jpeg), text];
  return references.length === 0 ? frame : [...references, { text: 'The frame' }, ...frame];
}

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
  /**
   * The parts of the reference pictures as they are now, read at the start of each call. See references.ts.
   * With none, and with an empty list, the request holds the frame alone.
   */
  references?: () => readonly Part[];
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): Recognizer {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const systemInstruction = buildSystemInstruction(deps.template, deps.catalog.products, deps.storeEntries);
  const instructionWithReferences = buildSystemInstruction(deps.template, deps.catalog.products, deps.storeEntries, true);
  // Each product that the model can name. The check of an answer needs only the IDs.
  const known = indexCatalog([
    ...deps.catalog.products, ...deps.storeEntries.map((entry) => scannedProduct(entry.item, entry.details)),
  ]);
  const responseSchema = recognitionResponseSchema(known.products.map((product) => product.id));
  // The ID of a store item is `gtin-<13 digits>`, so the instruction shows the model the code of each one.
  const shownCodes = new Set(deps.storeEntries.map((entry) => entry.item.gtin));

  return {
    async recognize(jpeg, opts) {
      // A still is the sharp second look at a package, so it keeps the default resolution.
      const low = deps.mediaResolution === 'low' && !opts.still;
      const references = deps.references?.() ?? [];
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: recognitionParts(jpeg, opts.exclude, references, opts.view, opts.context),
        config: {
          systemInstruction: references.length > 0 ? instructionWithReferences : systemInstruction,
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
      return normalizeResult(raw, { catalog: known, exclude: opts.exclude, minConfidence: deps.minConfidence, shownCodes });
    },
  };
}
