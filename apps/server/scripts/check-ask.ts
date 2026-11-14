// Asks the real service one question about one catalog product: npm run ask:check -- <productId> "<question>" [en|it]
// The command makes one text call, which costs money.
import { readFileSync } from 'node:fs';
import { ANSWERS_TEMPLATE_PATH, answerQuestion } from '../src/ask/ask';
import { createGeminiGenerate } from '../src/ask/gemini';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { loadConfig } from '../src/config';

async function main(): Promise<void> {
  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');
  const [productId, question, lang = 'en'] = process.argv.slice(2);
  if (productId === undefined || question === undefined) throw new Error('Give a product ID and a question.');
  if (lang !== 'en' && lang !== 'it') throw new Error(`The language must be "en" or "it". Got "${lang}".`);
  const product = indexCatalog(readCatalogFile(config.catalogPath)).get(productId);
  if (!product) throw new Error(`The catalog ${config.catalogPath} has no product "${productId}".`);

  const generate = createGeminiGenerate({ apiKey: config.geminiApiKey, model: config.geminiModel });
  const startedAt = Date.now();
  const answer = await answerQuestion(generate, readFileSync(ANSWERS_TEMPLATE_PATH, 'utf8'), { question, product, lang });
  console.log(`answer: ${answer}`);
  console.log(`ms: ${Date.now() - startedAt}`);
}

main().catch((error: Error) => {
  console.error(`ask:check failed. ${error.name}: ${error.message}`);
  process.exit(1);
});
