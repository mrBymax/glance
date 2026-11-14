import { GoogleGenAI, MediaResolution } from '@google/genai';
import { jpegPart } from '../label/gemini';
import { NOT_HELD, type Observation, observationResponseSchema, parseObservation } from './observation';

/** Says what one frame shows of the product in the hand. A call that fails rejects, and the caller counts it. */
export interface Observer {
  observe(jpeg: Uint8Array, opts: { signal: AbortSignal }): Promise<Observation>;
}

/** The path of the instruction file, from the working directory apps/server. */
export const OBSERVE_TEMPLATE_PATH = '../../agents/observe.md';

const BOX_RULE = '\n- `box`: the place of the product in the hand as [top, left, bottom, right]. Each number goes from 0 to 1000: the share of the frame height or width. It is null with `held` false.\n';

/** The instruction of the call. It holds no store item and no picture, so its size does not grow with the store. */
export function buildObserveInstruction(template: string, withBox: boolean): string {
  return withBox ? template.trimEnd() + BOX_RULE : template;
}

/**
 * One generateContent call for each frame, with no state between the calls and no store data in the request.
 * The call shape matches the type definitions of @google/genai 3.3.0, as the recognition call does.
 */
export function createGeminiObserver(deps: {
  apiKey: string; model: string; mediaResolution: 'default' | 'low';
  /** The text of agents/observe.md. */
  template: string;
  /** Ask for the place of the held product. */
  withBox: boolean;
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): Observer {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const systemInstruction = buildObserveInstruction(deps.template, deps.withBox);
  const responseSchema = observationResponseSchema(deps.withBox);

  return {
    async observe(jpeg, opts) {
      const response = await ai.models.generateContent({
        model: deps.model,
        contents: [jpegPart(jpeg)],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          abortSignal: opts.signal,
          // One attempt, and no `timeout`: the API rejects a server deadline below 10 seconds (see recognition/gemini.ts).
          httpOptions: { retryOptions: { attempts: 1 } },
          ...(deps.mediaResolution === 'low' ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
        },
      });
      let raw: unknown;
      try {
        raw = JSON.parse(response.text ?? '');
      } catch {
        return NOT_HELD;
      }
      return parseObservation(raw);
    },
  };
}
