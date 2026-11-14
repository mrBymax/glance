import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/kiosk/kiosk.css', 'utf8');
const vh = (name: string) => Number(new RegExp(`${name}:\\s*([\\d.]+)vh`).exec(css)?.[1]);

it('gives a total of 160 px or more and a row of 48 px or more on a 1080p screen', () => {
  expect(vh('--kiosk-total-size') * 10.8).toBeGreaterThanOrEqual(160);
  expect(vh('--kiosk-row-size') * 10.8).toBeGreaterThanOrEqual(48);
});
it('keeps the code at 15 cm or more, as large as the screen allows', () => {
  expect(css).toContain('--kiosk-code-size: max(15cm, min(50vw, 92vh))');
});
