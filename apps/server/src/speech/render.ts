import type { Profile } from '@glance/shared';
import type { Line } from '../sessions/types';
import { LINES_EN } from './lines.en';

/** Writes the text of a line for one shopper. Italian gives the English text until its line table exists. */
export function renderLine(line: Line, profile: Profile): string {
  // The key selects the template, so the template takes this line. TypeScript cannot follow that link.
  const template = LINES_EN[line.key] as (line: Line, profile: Profile) => string;
  return template(line, profile);
}
