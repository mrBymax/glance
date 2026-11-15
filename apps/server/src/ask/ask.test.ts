import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { type Generate, answerQuestion } from './ask';

const catalog = indexCatalog(readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url))));
const oat = catalog.get('oat-drink-1l')!;

it('sends the question with the data of one product', async () => {
  const generate = vi.fn<Generate>(async () => ' It contains gluten. ');
  const answer = await answerQuestion(generate, 'RULES', { question: 'Does it contain nuts?', product: oat, lang: 'en' });
  expect(answer).toBe('It contains gluten.');
  const [instruction, text] = generate.mock.calls[0]!;
  expect(instruction).toBe('RULES');
  expect(text).toContain('Does it contain nuts?');
  expect(text).toContain('"allergens":["gluten"]');
  expect(text).toContain('"price":"1.89"');
  expect(text).not.toContain('rye-bread');
});
it('cuts a long answer at a sentence end', async () => {
  const answer = await answerQuestion(async () => 'A short sentence. '.repeat(20), 'RULES', { question: 'q', product: oat, lang: 'en' });
  expect(answer.length).toBeLessThanOrEqual(200);
  expect(answer.endsWith('.')).toBe(true);
});
it('names the language, and gives the product name in it', async () => {
  const generate = vi.fn<Generate>(async () => 'Contiene glutine.');
  await answerQuestion(generate, 'RULES', { question: 'q', product: oat, lang: 'it' });
  const text = generate.mock.calls[0]![1];
  expect(text).toContain('Language: Italian');
  expect(text).toContain('"name":"Bevanda di avena"');
  expect(text).toContain('"vegan":true');
});
it('cuts a long answer with no sentence end at a word', async () => {
  const answer = await answerQuestion(async () => 'word '.repeat(60), 'RULES', { question: 'q', product: oat, lang: 'en' });
  expect(answer.length).toBeLessThanOrEqual(200);
  expect(answer.endsWith('word')).toBe(true);
});
it('rejects an empty answer', async () => {
  await expect(answerQuestion(async () => '  ', 'RULES', { question: 'q', product: oat, lang: 'en' })).rejects.toThrow();
});
