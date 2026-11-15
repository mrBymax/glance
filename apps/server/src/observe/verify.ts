import { type Content, FunctionCallingConfigMode, type FunctionDeclaration, GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';
import { jpegPart, referencePicturePart } from '../label/gemini';
import type { StoreEntry } from '../products/storeEntries';
import type { Candidate, ProductSearch } from '../search/productSearch';

/** A store item that the held product can be, with its reference pictures as JPEG bytes. */
export type VerifyCandidate = { entry: StoreEntry; pictures: readonly Uint8Array[] };

export type VerifyAnswer = {
  /** The code of the store item that the held product is, or null. It is a candidate of the request or a result of a search of this call. */
  gtin: string | null;
  /** 0 to 1. */
  confidence: number;
  /** What decided: package text, or the shape, the print, and the colors. `none` with no item. */
  seen: 'text' | 'look' | 'none';
  /** One sentence of the model, for the log. */
  reason: string;
  /** The number of model calls, and of functions that the server ran for the model. */
  calls: number;
  lookups: number;
};

/**
 * Decides which candidate the held product is, from some frames of one appearance. A call that fails rejects.
 * `seen` is what the observe calls read in the frames, as one line of text.
 */
export interface Verifier {
  verify(
    input: { frames: readonly Uint8Array[]; candidates: readonly VerifyCandidate[]; seen: string },
    opts: { signal: AbortSignal },
  ): Promise<VerifyAnswer>;
}

/** The path of the instruction file, from the working directory apps/server. */
export const VERIFY_TEMPLATE_PATH = '../../agents/verify.md';

/** The model can ask the server this many times. Then the next call takes no function, so it must answer. */
export const MAX_TOOL_ROUNDS = 2;
/** A search of the model returns at most this number of items. */
const MAX_SEARCH_LIMIT = 5;

const NO_ITEM = { gtin: null, confidence: 0, seen: 'none', reason: '' } as const;

const AnswerSchema = z.object({
  gtin: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  seen: z.enum(['text', 'look', 'none']).catch('none'),
  reason: z.string().catch(''),
});

/** The JSON Schema of the answer. `gtin` is free text: a search of the call can return an item that is no candidate. */
export function verifyResponseSchema(): unknown {
  return z.toJSONSchema(z.object({
    gtin: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    seen: z.enum(['text', 'look', 'none']),
    reason: z.string(),
  }));
}

/**
 * The two functions of the model. The server runs them on the ProductSearch of the store, so the model can search
 * again with a translated or corrected word. An MCP server can give other clients the same two functions.
 */
export const VERIFY_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'Searches the items that the store sells by words of a package. Returns the best items with a score from 0 to 1.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words of the product name, the flavor, or the type, in each language.' },
        brand: { type: 'string', description: 'The brand, when the package shows one.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_SEARCH_LIMIT },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Returns the data of one store item by its code: name, brand, pack size, and the names of other languages.',
    parametersJsonSchema: { type: 'object', properties: { gtin: { type: 'string', description: 'The code of 13 digits.' } }, required: ['gtin'] },
  },
];

/** One store item as the model gets it: no price, because the model selects an item and the store list has its price. */
export function describeItem(entry: StoreEntry): Record<string, unknown> {
  const { item, details } = entry;
  const brand = item.brand ?? details?.brand ?? null;
  const packSize = item.packSize ?? details?.quantity ?? null;
  const otherNames = [...new Set(details?.texts?.names ?? [])].filter((name) => name.toLowerCase() !== item.name.toLowerCase());
  return {
    gtin: item.gtin, name: item.name,
    ...(brand === null ? {} : { brand }), ...(packSize === null ? {} : { packSize }),
    ...(otherNames.length === 0 ? {} : { otherNames }),
  };
}

function candidateLine(entry: StoreEntry): string {
  const { gtin, name, brand, packSize, otherNames } = describeItem(entry) as { gtin: string; name: string; brand?: string; packSize?: string; otherNames?: string[] };
  return `Candidate ${gtin}: ${name}${brand === undefined ? '' : ` | brand: ${brand}`}${packSize === undefined ? '' : ` | pack: ${packSize}`}`
    + (otherNames === undefined ? '' : ` | also named: ${otherNames.join(', ')}`);
}

/**
 * The parts of the first request: each candidate with its reference pictures at the low media resolution, then the
 * frames at the default resolution, then what the observe calls read.
 */
export function verifyParts(frames: readonly Uint8Array[], candidates: readonly VerifyCandidate[], seen: string): Part[] {
  return [
    ...(candidates.length === 0 ? [{ text: 'The search gave no candidate. Search the store with the words that you read.' }] : []),
    ...candidates.flatMap(({ entry, pictures }): Part[] => [{ text: candidateLine(entry) }, ...pictures.map(referencePicturePart)]),
    { text: 'Frames of the held product, oldest first' },
    ...frames.map(jpegPart),
    { text: `A first reader saw in these frames: ${seen}\nWhich of the candidates, if any, is the held product?` },
  ];
}

/**
 * Runs one function of the model. Returns the answer for the model, and the codes of the items in it.
 * A function that the server does not have, and a bad argument, give an error text and no item.
 */
export async function runVerifyFunction(
  search: ProductSearch, name: string | undefined, args: Record<string, unknown> | undefined,
): Promise<{ response: Record<string, unknown>; gtins: string[] }> {
  if (name === 'search_products') {
    const query = typeof args?.query === 'string' ? args.query : '';
    const brand = typeof args?.brand === 'string' ? args.brand : null;
    const limit = typeof args?.limit === 'number' ? Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.round(args.limit))) : MAX_SEARCH_LIMIT;
    const found: Candidate[] = await search.search({ brand, name: query }, limit);
    const items = await Promise.all(found.map(async (candidate) => {
      const entry = await search.get(candidate.gtin);
      return entry ? [{ ...describeItem(entry), score: candidate.score, matched: candidate.reasons }] : [];
    }));
    return { response: { items: items.flat() }, gtins: found.map((candidate) => candidate.gtin) };
  }
  if (name === 'get_product') {
    const entry = typeof args?.gtin === 'string' ? await search.get(args.gtin.replace(/\D/g, '').padStart(13, '0')) : undefined;
    return entry ? { response: { item: describeItem(entry) }, gtins: [entry.item.gtin] } : { response: { error: 'The store has no item with this code.' }, gtins: [] };
  }
  return { response: { error: `No function has the name ${name ?? ''}.` }, gtins: [] };
}

/**
 * One verify call is up to MAX_TOOL_ROUNDS + 1 generateContent calls. Each call has the two functions and the JSON
 * schema of the answer: the Gemini 3 models take both in one request (function calling page of the Gemini API,
 * read on 2026-11-14, and a run with gemini-3.5-flash-lite on that day). The history holds the content of the model
 * as it came, so each function call keeps its thought signature, which a Gemini 3 model needs back.
 * The answer names only a candidate of the request, or an item that a search of this call returned.
 */
export function createGeminiVerifier(deps: {
  apiKey: string; model: string;
  /** The text of agents/verify.md. */
  template: string;
  search: ProductSearch;
  /** In place of the global fetch, for a test. */
  fetch?: typeof fetch;
}): Verifier {
  const ai = new GoogleGenAI({ apiKey: deps.apiKey, ...(deps.fetch ? { httpOptions: { fetch: deps.fetch } } : {}) });
  const responseSchema = verifyResponseSchema();

  return {
    async verify(input, opts) {
      const contents: Content[] = [{ role: 'user', parts: verifyParts(input.frames, input.candidates, input.seen) }];
      const allowed = new Set(input.candidates.map((candidate) => candidate.entry.item.gtin));
      let lookups = 0;
      for (let call = 1; ; call += 1) {
        const lastCall = call > MAX_TOOL_ROUNDS;
        const response = await ai.models.generateContent({
          model: deps.model,
          contents,
          config: {
            systemInstruction: deps.template,
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
            tools: [{ functionDeclarations: VERIFY_FUNCTIONS }],
            ...(lastCall ? { toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.NONE } } } : {}),
            abortSignal: opts.signal,
            // One attempt, and no `timeout`: the API rejects a server deadline below 10 seconds (see recognition/gemini.ts).
            httpOptions: { retryOptions: { attempts: 1 } },
          },
        });
        const asked = response.functionCalls ?? [];
        const said = response.candidates?.[0]?.content;
        if (asked.length > 0 && !lastCall && said) {
          contents.push(said);
          const answers: Part[] = [];
          for (const { id, name, args } of asked) {
            const { response: result, gtins } = await runVerifyFunction(deps.search, name, args);
            lookups += 1;
            for (const gtin of gtins) allowed.add(gtin);
            answers.push({ functionResponse: { ...(id === undefined ? {} : { id }), name: name ?? '', response: result } });
          }
          contents.push({ role: 'user', parts: answers });
          continue;
        }

        let raw: unknown;
        try {
          raw = JSON.parse(response.text ?? '');
        } catch {
          return { ...NO_ITEM, calls: call, lookups };
        }
        const parsed = AnswerSchema.safeParse(raw);
        if (!parsed.success) return { ...NO_ITEM, calls: call, lookups };
        const gtin = parsed.data.gtin === null ? null : parsed.data.gtin.replace(/\D/g, '').padStart(13, '0');
        // The final guard: a code that the request and the searches did not give is no item.
        if (gtin !== null && !allowed.has(gtin)) return { ...NO_ITEM, reason: parsed.data.reason, calls: call, lookups };
        return { ...parsed.data, gtin, seen: gtin === null ? 'none' : parsed.data.seen, calls: call, lookups };
      }
    },
  };
}
