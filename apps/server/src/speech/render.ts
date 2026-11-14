import type { Lang, Profile } from '@glance/shared';
import type { Line } from '../sessions/types';
import { LINES_EN, type LineTemplates } from './lines.en';
import { LINES_IT } from './lines.it';

const LINES: Record<Lang, LineTemplates> = { en: LINES_EN, it: LINES_IT };

/** Writes the text of a line for one shopper, in the language of the profile. */
export function renderLine(line: Line, profile: Profile): string {
  // The key selects the template, so the template takes this line. TypeScript cannot follow that link.
  const template = LINES[profile.lang][line.key] as (line: Line, profile: Profile) => string;
  return template(line, profile);
}
