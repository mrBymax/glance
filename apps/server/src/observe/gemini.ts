import { GoogleGenAI, MediaResolution, type Part } from '@google/genai';
import type { FrameHeader } from '@glance/shared';
import { jpegPart } from '../label/gemini';
import { cropWithContextParts } from '../recognition/gemini';
import { CROP_VIEW_LINE } from '../recognition/prompt';
import { NOT_HELD, type Observation, observationResponseSchema, parseObservation } from './observation';

/**
 * Says what one frame shows of the product in the hand. A call that fails rejects, and the caller counts it.
 * `view` is the view of the frame header: `crop` for a crop of the phone around an object that it found.
 * `context` is the context image of a crop: the whole frame in a small size.
 */
export interface Observer {
  observe(jpeg: Uint8Array, opts: { signal: AbortSignal; view?: FrameHeader['view']; context?: Uint8Array }): Promise<Observation>;
}

/** The parts of one request: the frame alone, or a crop after its context image, with the line that names the crop. */
function observeParts(jpeg: Uint8Array, view: FrameHeader['view'], context: Uint8Array | undefined): Part[] {
  if (view !== 'crop') return [jpegPart(jpeg)];
  return [...(context ? cropWithContextParts(jpeg, context) : [jpegPart(jpeg)]), { text: CROP_VIEW_LINE }];
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
        contents: observeParts(jpeg, opts.view, opts.context),
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
