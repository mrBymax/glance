import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { readCatalogFile } from '../catalog/catalog';
import type { StoreEntry } from '../products/storeEntries';
import { buildSystemInstruction, recognitionResponseSchema, userText } from './prompt';

const dev = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const template = 'Rules.\n{{catalog}}\nStore:\n{{storeItems}}\nEnd.';
const entries: StoreEntry[] = [
  { item: { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' }, details: null },
  { item: { gtin: '6438574558384', priceCents: 349, name: 'Paper cups' }, details: null },
  {
    item: { gtin: '7312220096019', priceCents: 279, name: 'Biscoff' },
    details: { brand: 'Lotus', quantity: '250 g', allergens: ['gluten', 'soy'], vegan: true, vegetarian: true },
  },
];
type Schema = {
  required: string[];
  properties: Record<string, { enum?: string[]; anyOf?: unknown[]; items?: { enum: string[] }; required?: string[]; properties?: Record<string, unknown> }>;
};

it('lists each product with ID, name, brand, pack size, and look', () => {
  const text = buildSystemInstruction(template, dev, []);
  for (const p of dev) for (const part of [p.id, p.name.en, p.brand, p.packSize, p.visual]) expect(text).toContain(part);
  expect(text).toContain('lookAlikes: oat-drink-barista-1l');
  expect(text).not.toContain('{{catalog}}');
});
it('lists each store item with the ID of a scanned product, its name, and its brand and pack size when a source has them', () => {
  const lines = buildSystemInstruction(template, dev, entries).split('\n');
  expect(lines.slice(dev.length + 1)).toEqual([
    'Store:',
    '- id: gtin-3017624010701 | name: Nutella | brand: Ferrero | pack: 400 g',
    '- id: gtin-6438574558384 | name: Paper cups',
    '- id: gtin-7312220096019 | name: Biscoff | brand: Lotus | pack: 250 g',
    'End.',
  ]);
  expect(lines.join('\n')).not.toContain('{{storeItems}}');
});
it('says so when the catalog or the store list is empty', () => {
  expect(buildSystemInstruction(template, [], []).split('\n')).toEqual([
    'Rules.', '(The catalog is empty.)', 'Store:', '(The store has no other items.)', 'End.',
  ]);
});
it('writes one line for each product, between the text of the template', () => {
  const lines = buildSystemInstruction(template, dev, []).split('\n');
  expect(lines).toHaveLength(dev.length + 4);
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
  const text = buildSystemInstruction(template, dev, entries);
  for (const p of dev) expect(text).not.toContain(String(p.priceCents));
  for (const entry of entries) expect(text).not.toContain(String(entry.item.priceCents));
});
it('rejects a template with no placeholder', () => {
  expect(() => buildSystemInstruction('Rules. {{storeItems}}', dev, [])).toThrow(/\{\{catalog\}\}/);
  expect(() => buildSystemInstruction('Rules. {{catalog}}', dev, [])).toThrow(/\{\{storeItems\}\}/);
});
it('limits the answer to the catalog IDs', () => {
  const schema = recognitionResponseSchema(['a', 'b']) as Schema;
  expect(schema.required).toEqual(['status', 'productId', 'candidates', 'confidence', 'aimHint', 'gesture', 'code']);
  expect(schema.properties.status!.enum).toEqual(['identified', 'ambiguous', 'unsure', 'unknown', 'none']);
  expect(schema.properties.productId!.anyOf).toEqual([{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }]);
  expect(schema.properties.candidates!.items!.enum).toEqual(['a', 'b']);
  expect(schema.properties.aimHint!.enum).toEqual(['none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn']);
});
it('with no product the answer can name none', () => {
  const schema = recognitionResponseSchema([]) as Schema & { properties: { candidates: { maxItems?: number } } };
  expect(schema.properties.productId).toEqual({ type: 'null' });
  expect(schema.properties.candidates.maxItems).toBe(0);
});
it('asks for the code of the frame', () => {
  const { code } = (recognitionResponseSchema(['a']) as Schema).properties;
  expect(code!.required).toEqual(['visible', 'digits']);
  expect(code!.properties).toEqual({ visible: { type: 'boolean' }, digits: { type: ['string', 'null'] } });
});
it('writes the exclude list', () => {
  expect(userText([])).toBe('Exclude: none.');
  expect(userText(['a', 'b'])).toBe('Exclude: a, b.');
});
it('the instruction file has the placeholders for the catalog and for the store items', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  expect(text).toContain('{{catalog}}');
  expect(text).toContain('{{storeItems}}');
});
it('the instruction file says that the package of a store item can be in another language, and that a similar product is no match', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  expect(text).toMatch(/another language/);
  expect(text).toContain('"Kartonkipikari / Pappersmugg" is "Paper cups"');
  expect(text).toMatch(/similar product is not the item/);
});
it('the instruction file names each status, each aim hint, and each gesture of the answer', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  const words = ['identified', 'ambiguous', 'unsure', 'unknown', 'none', 'left', 'right', 'up', 'down', 'closer', 'farther', 'turn',
    'thumbs_up', 'thumbs_down', 'candidates', 'aimHint', 'confidence', 'productId', 'Exclude', 'code', 'visible', 'digits'];
  for (const word of words) expect(text).toContain(word);
});
it('the instruction file tells the model not to guess a digit, and to answer none for the barcode side', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  expect(text).toContain('Never guess a digit');
  expect(text).toMatch(/barcode side[^.]*`none`/);
});
it('adds the rules for reference pictures only for a call that holds some', () => {
  const plain = buildSystemInstruction(template, dev, entries);
  expect(plain).not.toContain('Reference pictures');
  const text = buildSystemInstruction(template, dev, entries, true);
  expect(text.startsWith(plain)).toBe(true);
  expect(text).toMatch(/## Reference pictures/);
  expect(text).toMatch(/The last image is the frame/);
  expect(text).toMatch(/background means nothing/);
  expect(text).toMatch(/Never answer about a product that only a reference picture shows/);
});
it('the instruction file keeps the code to a product that a hand holds, so a shelf label asks for no still', () => {
  const text = readFileSync('../../agents/recognition.md', 'utf8');
  expect(text).toMatch(/`visible`: true when a hand holds a product up/);
  expect(text).toMatch(/shelf label[^.]*false/);
});
