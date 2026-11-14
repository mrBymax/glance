import { z } from 'zod';
import { type AimHint, AimHintSchema } from '@glance/shared';

/** What one frame shows, after the checks of the recognition worker. */
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
};

const ResultObjectSchema = z.object({
  status: z.enum(['identified', 'ambiguous', 'unsure', 'unknown', 'none']),
  productId: z.string().min(1).nullable(),
  candidates: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  aimHint: AimHintSchema,
  gesture: z.enum(['none', 'thumbs_up', 'thumbs_down']),
});

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
});
