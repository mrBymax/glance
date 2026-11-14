// Checks the recognition model with the real service: npm run model:check -- [frame.jpg]
// The model lookup costs nothing. With a frame path, the script makes one recognition call, which costs money.
import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { TIMING } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { loadConfig } from '../src/config';
import { RECOGNITION_TEMPLATE_PATH, createGeminiRecognizer } from '../src/recognition/gemini';

async function main(): Promise<void> {
  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');
  const framePath = process.argv[2];

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const model = await ai.models.get({ model: config.geminiModel });
  console.log(`model: ${model.name}`);
  if (framePath === undefined) return;

  const recognizer = createGeminiRecognizer({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    mediaResolution: config.geminiMediaResolution,
    minConfidence: config.minConfidence,
    catalog: indexCatalog(readCatalogFile(config.catalogPath)),
    template: readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8'),
  });
  const startedAt = Date.now();
  const result = await recognizer.recognize(readFileSync(framePath), {
    exclude: [], still: false, signal: AbortSignal.timeout(TIMING.recognitionTimeoutMs),
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(`ms: ${Date.now() - startedAt}`);
}

main().catch((error: Error) => {
  console.error(`model:check failed. ${error.name}: ${error.message}`);
  process.exit(1);
});
