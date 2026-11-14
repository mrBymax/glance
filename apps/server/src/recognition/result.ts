import { z } from 'zod';
import { type AimHint, AimHintSchema, normalizeGtin } from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';

/** What one frame shows, after the checks of normalizeResult. */
export type RecognitionResult = {
  status: 'identified' | 'ambiguous' | 'unsure' | 'unknown' | 'none';
  /** The ID of a catalog product or of a store item for 'identified', else null. */
  productId: string | null;
  /** Catalog IDs for 'ambiguous', else an empty list. */
  candidates: string[];
  /** 0 to 1. */
  confidence: number;
  aimHint: AimHint;
  gesture: 'none' | 'thumbs_up' | 'thumbs_down';
  code: FrameCode;
};

/**
 * The barcode of the frame, as the model sees it. `visible`: a barcode, or the package side with its barcode, is in the frame.
 * `digits`: the digits under the bars, or null. The model reads print and can write digits that are not there,
 * so the digits count only with a right check digit and an item of the store list.
 */
export type FrameCode = { visible: boolean; digits: string | null };

const NO_CODE: FrameCode = Object.freeze({ visible: false, digits: null });
const CodeSchema = z.object({ visible: z.boolean(), digits: z.string().nullable() });

const ResultObjectSchema = z.object({
  status: z.enum(['identified', 'ambiguous', 'unsure', 'unknown', 'none']),
  productId: z.string().min(1).nullable(),
  candidates: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  aimHint: AimHintSchema,
  gesture: z.enum(['none', 'thumbs_up', 'thumbs_down']),
  code: CodeSchema,
});
/**
 * The answer of the model. `held` says where the product is: true when a hand holds it and presents it, false for
 * a product on a table or a shelf, or in the hand of another person. A result has no such field: normalizeResult
 * turns an answer with `held` false into a frame with no product.
 * An answer with no code, or with a bad one, keeps its other fields.
 */
const AnswerSchema = ResultObjectSchema.extend({ held: z.boolean(), code: CodeSchema.catch(NO_CODE) });

export const RecognitionResultSchema: z.ZodType<RecognitionResult> = ResultObjectSchema;

/** Some fields of a result. A fake script writes a result this way. An unknown key fails. */
export const RecognitionResultPartSchema = ResultObjectSchema.partial().strict();

/** The result for a frame with no product. Frozen, because each caller shares it. */
export const NO_RESULT: RecognitionResult = Object.freeze({
  status: 'none',
  productId: null,
  candidates: Object.freeze([]) as unknown as string[],
  confidence: 0,
  aimHint: 'none',
  gesture: 'none',
  code: NO_CODE,
});

function cleanCode(code: FrameCode, shownCodes: ReadonlySet<string> | undefined): FrameCode {
  const digits = code.digits === null ? '' : code.digits.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return { visible: code.visible, digits: null };
  // The model saw a code, and the digits can be a copy of an ID. The still that follows a visible code reads them.
  if (shownCodes?.has(normalizeGtin(digits) ?? '')) return { visible: true, digits: null };
  return { visible: true, digits };
}

/**
 * Checks the answer of the model against the catalog and the request.
 * An answer about a product that no hand holds counts as no product.
 * It never turns another status into 'identified', so the voice never names a product that the model did not name.
 * Each status of an answer about a product in a hand keeps the code of the frame.
 */
export function normalizeResult(
  raw: unknown,
  ctx: {
    catalog: CatalogIndex; exclude: readonly string[]; minConfidence: number;
    /**
     * The codes of 13 digits that the instruction shows: the ID of a store item holds its code. Digits that are such
     * a code do not count. The model wrote the code of a store item for a barcode that it could not read: 6 times in
     * about 640 calls (2026-11-14), and 5 of the 6 codes were those of another item of the same brand.
     */
    shownCodes?: ReadonlySet<string>;
  },
): RecognitionResult {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return NO_RESULT;
  // The voice names only a product in the hand. A can on a table behind the hand has a name too, and the shopper did not ask for it.
  // The code goes with it: a barcode that no hand holds asks for no still.
  if (!parsed.data.held) return NO_RESULT;
  const { status, productId, confidence, aimHint, gesture } = parsed.data;
  /** Only 'identified' keeps a product ID, and only 'ambiguous' keeps candidates. */
  const code = cleanCode(parsed.data.code, ctx.shownCodes);
  const plain = { productId: null, candidates: [], confidence, aimHint, gesture, code };

  if (status === 'identified') {
    if (productId === null || !ctx.catalog.get(productId)) return { ...plain, status: 'unknown' };
    // R9: the shopper just skipped this product, so the frame counts as a frame with no product.
    if (ctx.exclude.includes(productId)) return { ...NO_RESULT, code };
    if (confidence < ctx.minConfidence) return { ...plain, status: 'unsure' };
    return { ...plain, status, productId };
  }

  if (status === 'ambiguous') {
    const candidates = [...new Set(parsed.data.candidates)].filter((id) => ctx.catalog.get(id) && !ctx.exclude.includes(id));
    if (candidates.length >= 2) return { ...plain, status, candidates };
    // One candidate is no answer: the model saw a second product that the catalog or the request rules out.
    if (candidates.length === 1) return { ...plain, status: 'unsure', aimHint: 'turn' };
    return { ...plain, status: 'unknown' };
  }

  return { ...plain, status };
}
