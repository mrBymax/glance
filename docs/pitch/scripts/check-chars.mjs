// Fails when the deck sources or the docs of docs/pitch hold a character that the anti-slop skill bans: an emoji, a
// dash other than "-", a curly quote, an ellipsis character, an arrow, a multiplication sign, a check mark, a bullet
// or middle dot, a box-drawing character, or a star. HTML entities that render as one of them count too.
//   node docs/pitch/scripts/check-chars.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

// Quoted material that stays as its author wrote it: the pitch script of the owner.
const EXCEPTIONS = new Set(['script.md']);

const FILES = [
  'deck.src.html',
  'notes.md',
  'design.md',
  'README.md',
  ...readdirSync(here('scripts')).filter((name) => name.endsWith('.mjs') && name !== 'check-chars.mjs').map((name) => `scripts/${name}`),
  ...readdirSync(here('diagrams')).filter((name) => name.endsWith('.html')).map((name) => `diagrams/${name}`),
].filter((file) => !EXCEPTIONS.has(file));

const BANNED = new RegExp(
  [
    '[\\u2012-\\u2015]', // figure dash, en dash, em dash, horizontal bar
    '[\\u2018\\u2019\\u201A-\\u201F]', // curly quotes
    '\\u2026', // ellipsis
    '[\\u2022\\u2023\\u2043\\u00B7\\u25AA-\\u25AB\\u25B8\\u25CF\\u25A0\\u25A1]', // bullets and middle dot
    '[\\u2190-\\u21FF\\u27F0-\\u27FF\\u2B00-\\u2BFF]', // arrows
    '\\u00D7', // multiplication sign
    '[\\u2713-\\u2718\\u26A0]', // check marks, crosses, warning sign
    '[\\u2500-\\u257F]', // box drawing
    '[\\u2605\\u2606\\u2726\\u2728]', // stars and sparkles
    '[\\u{1F300}-\\u{1FAFF}]', // emoji
    '&(?:mdash|ndash|ldquo|rdquo|lsquo|rsquo|hellip|middot|bull|times|rarr|larr|harr|check);',
  ].join('|'),
  'gu',
);

let count = 0;
for (const file of FILES) {
  readFileSync(here(file), 'utf8').split('\n').forEach((line, index) => {
    for (const match of line.matchAll(BANNED)) {
      count += 1;
      console.log(`${file}:${index + 1}: ${JSON.stringify(match[0])} in ${line.trim().slice(0, 100)}`);
    }
  });
}
console.log(`${count} banned characters in ${FILES.length} files`);
if (count > 0) process.exit(1);
