import { z } from 'zod';
import { type AimHint, AimHintSchema } from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';

/** What one frame shows, after the checks of normalizeResult. */
export type RecognitionResult = {
  status: 'identified' | 'ambiguous' | 'unsure' | 'unknown' | 'none';
  /** A catalog ID for 'identified', else null. */
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
// An answer with no code, or with a bad one, keeps its other fields.
const AnswerSchema = ResultObjectSchema.extend({ code: CodeSchema.catch(NO_CODE) });

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

function cleanCode(code: FrameCode): FrameCode {
  const digits = code.digits === null ? '' : code.digits.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return { visible: code.visible, digits: null };
  return { visible: true, digits };
}

/**
 * Checks the answer of the model against the catalog and the request.
 * It never turns another status into 'identified', so the voice never names a product that the model did not name.
 * Each status keeps the code of the frame.
 */
export function normalizeResult(
  raw: unknown, ctx: { catalog: CatalogIndex; exclude: readonly string[]; minConfidence: number },
): RecognitionResult {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return NO_RESULT;
  const { status, productId, confidence, aimHint, gesture } = parsed.data;
  /** Only 'identified' keeps a product ID, and only 'ambiguous' keeps candidates. */
  const code = cleanCode(parsed.data.code);
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
