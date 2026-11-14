import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/styles/touch.css', 'utf8');

it('raises the Astryx control heights to 48 px or more', () => {
  expect(css).toMatch(/--size-element-sm:\s*48px/);
  expect(css).toMatch(/--size-element-md:\s*48px/);
  expect(css).toMatch(/--size-element-lg:\s*56px/);
  expect(css).toMatch(/\.astryx-button\s*\{[^}]*min-inline-size:\s*48px/);
});
