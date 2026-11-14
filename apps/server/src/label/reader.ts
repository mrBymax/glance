import { z } from 'zod';

/** What the model read on the still of a label. Each text is what the package shows, and null when the model cannot read it. */
export type LabelAnswer = {
  /** Each run of digits near a barcode, as printed. */
  digits: string[];
  brand: string | null;
  name: string | null;
  packSize: string | null;
  /** 0 to 1, for the brand and the name. */
  confidence: number;
};

/** Reads the label of one still. A call that fails rejects. */
export interface LabelReader {
  read(jpeg: Uint8Array, opts: { signal: AbortSignal }): Promise<LabelAnswer>;
}

const printed = z.string().nullable().transform((value) => {
  const clean = value?.trim() ?? '';
  return clean === '' ? null : clean;
});

export const LabelAnswerSchema = z.object({
  digits: z.array(z.string()),
  brand: printed,
  name: printed,
  packSize: printed,
  confidence: z.number().min(0).max(1),
});

/** The answer for a still with no label. Frozen, because each caller shares it. */
export const NO_LABEL: LabelAnswer = Object.freeze({
  digits: Object.freeze([]) as unknown as string[], brand: null, name: null, packSize: null, confidence: 0,
});

/** An answer that fails the schema counts as a still with no label. */
export function parseLabelAnswer(raw: unknown): LabelAnswer {
  const parsed = LabelAnswerSchema.safeParse(raw);
  return parsed.success ? parsed.data : NO_LABEL;
}
