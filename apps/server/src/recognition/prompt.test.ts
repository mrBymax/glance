import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import { buildSystemInstruction, recognitionResponseSchema, userText } from './prompt';

const dev = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const template = 'Rules.\n{{catalog}}\nEnd.';
type Schema = { required: string[]; properties: Record<string, { enum?: string[]; anyOf?: unknown[]; items?: { enum: string[] } }> };

it('lists each product with ID, name, brand, pack size, and look', () => {
  const text = buildSystemInstruction(template, dev);
  for (const p of dev) for (const part of [p.id, p.name.en, p.brand, p.packSize, p.visual]) expect(text).toContain(part);
  expect(text).toContain('lookAlikes: oat-drink-barista-1l');
  expect(text).not.toContain('{{catalog}}');
});
it('writes one line for each product, between the text of the template', () => {
  const lines = buildSystemInstruction(template, dev).split('\n');
  expect(lines).toHaveLength(dev.length + 2);
  expect(lines[0]).toBe('Rules.');
  expect(lines[1]).toBe(
    '- id: oat-drink-1l | name: Oat drink | brand: Oatly | pack: 1 L'
    + ' | look: Tall carton, light blue and white, the word OATLY in large black letters. | lookAlikes: oat-drink-barista-1l',
  );
  expect(lines[3]).toBe(
    '- id: rye-bread | name: Rye bread | brand: Demo Bakery | pack: 500 g | look: Clear plastic bag with a brown label, dark sliced bread inside.',
  );
  expect(lines.at(-1)).toBe('End.');
});
it('holds no price', () => {
  const text = buildSystemInstruction(template, dev);
  for (const p of dev) expect(text).not.toContain(String(p.priceCents));
});
it('rejects a template with no placeholder', () => {
  expect(() => buildSystemInstruction('Rules.', dev)).toThrow(/\{\{catalog\}\}/);
});
it('limits the answer to the catalog IDs', () => {
  const schema = recognitionResponseSchema(['a', 'b']) as Schema;
  expect(schema.required).toEqual(['status', 'productId', 'candidates', 'confidence', 'aimHint', 'gesture']);
  expect(schema.properties.status!.enum).toEqual(['identified', 'ambiguous', 'unsure', 'unknown', 'none']);
  expect(schema.properties.productId!.anyOf).toEqual([{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }]);
  expect(schema.properties.candidates!.items!.enum).toEqual(['a', 'b']);
  expect(schema.properties.aimHint!.enum).toEqual(['none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn']);
});
it('writes the exclude list', () => {
  expect(userText([])).toBe('Exclude: none.');
  expect(userText(['a', 'b'])).toBe('Exclude: a, b.');
});
it('the instruction file has the catalog placeholder', () => {
  expect(readFileSync('../../agents/recognition.md', 'utf8')).toContain('{{catalog}}');
});
it('the instruction file names each status, each aim hint, and each gesture of the answer', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  const words = ['identified', 'ambiguous', 'unsure', 'unknown', 'none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn',
    'thumbs_up', 'thumbs_down', 'candidates', 'aimHint', 'confidence', 'productId', 'Exclude'];
  for (const word of words) expect(text).toContain(word);
});
