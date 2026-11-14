import { z } from 'zod';
import { type AimHint, AimHintSchema } from '@glance/shared';

/** How much of the print on the held package the model read in one frame. */
export type Legible = 'none' | 'some' | 'clear';

/**
 * What one frame shows of the product in the hand, as the observe call reads it. The call knows no store item,
 * so no field can hold a copy of a store ID. Each text is as printed, in the language of the package.
 */
export type Observation = {
  /** A hand holds a product and presents it. With false, each other field is empty. */
  held: boolean;
  /** The place of the held product in the frame as [top, left, bottom, right], each from 0 to 1000, or null. */
  box: [number, number, number, number] | null;
  kind: string | null;
  colors: string[];
  legible: Legible;
  brand: string | null;
  name: string | null;
  variant: string | null;
  size: string | null;
  texts: string[];
  /** Digit runs near a barcode, with no space. */
  digits: string[];
  aimHint: AimHint;
};

/** The observation of a frame with no product in a hand. Frozen, because each caller shares it. */
export const NOT_HELD: Observation = Object.freeze({
  held: false, box: null, kind: null, colors: Object.freeze([]) as unknown as string[], legible: 'none',
  brand: null, name: null, variant: null, size: null, texts: Object.freeze([]) as unknown as string[],
  digits: Object.freeze([]) as unknown as string[], aimHint: 'none',
});

const MAX_TEXT_CHARS = 80;

const printed = z.string().nullable().catch(null).transform((value) => {
  const clean = value?.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_CHARS) ?? '';
  // A model writes these words for a text that it did not read.
  return clean === '' || /^(null|none|unknown|n\/a|unreadable|illegible)$/i.test(clean) ? null : clean;
});
const words = z.array(z.string()).catch([]).transform((list) => list.flatMap((text) => printed.parse(text) ?? []));
const box = z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().catch(null).transform((value) => {
  if (value === null) return null;
  const [top, left, bottom, right] = value.map((edge) => Math.min(1000, Math.max(0, Math.round(edge)))) as [number, number, number, number];
  return bottom > top && right > left ? [top, left, bottom, right] as [number, number, number, number] : null;
});

const AnswerSchema = z.object({
  held: z.boolean(),
  box: box.optional().transform((value) => value ?? null),
  kind: printed,
  colors: words,
  legible: z.enum(['none', 'some', 'clear']).catch('none'),
  brand: printed,
  name: printed,
  variant: printed,
  size: printed,
  texts: words,
  digits: words.transform((list) => list.map((run) => run.replace(/\s/g, '')).filter((run) => /^\d{8,14}$/.test(run))),
  aimHint: AimHintSchema.catch('none'),
});

/**
 * Checks the answer of the observe call. An answer with no `held` field counts as a frame with no product.
 * Each other field is read alone: a field with a wrong type counts as not read, and the other fields stay.
 * An answer with `held` false loses each other field, so a can on a table behind the hand gives no text.
 */
export function parseObservation(raw: unknown): Observation {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.held) return NOT_HELD;
  return parsed.data;
}

/**
 * The JSON Schema of the answer. `held` is the first field, so the model decides where the product is before it
 * describes it. `withBox` adds the place of the product: the verify call and the picture search crop the frame with it.
 */
export function observationResponseSchema(withBox: boolean): unknown {
  const text = z.string().nullable();
  return z.toJSONSchema(z.object({
    held: z.boolean(),
    ...(withBox ? { box: z.array(z.number().int().min(0).max(1000)).min(4).max(4).nullable() } : {}),
    kind: text,
    colors: z.array(z.string()).max(3),
    legible: z.enum(['none', 'some', 'clear']),
    brand: text,
    name: text,
    variant: text,
    size: text,
    texts: z.array(z.string()).max(6),
    digits: z.array(z.string()),
    aimHint: AimHintSchema,
  }));
}
