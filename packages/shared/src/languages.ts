import { z } from 'zod';

export const LANGS = ['en', 'it'] as const;
export type Lang = (typeof LANGS)[number];
export const LangSchema = z.enum(LANGS);

export type Localized = { en: string; it?: string };
export const LocalizedSchema = z.object({
  en: z.string().min(1),
  it: z.string().min(1).optional(),
});

/** Returns the text in `lang`, or the English text when that language is missing. */
export function localize(text: Localized, lang: Lang): string {
  return text[lang] ?? text.en;
}
