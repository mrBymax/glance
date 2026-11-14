import { readFileSync } from 'node:fs';
import { buildApp } from './app';
import { type CatalogIndex, indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { type Config, ConfigError, loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { MongoStore } from './db/mongo';
import type { Store } from './db/store';
import { ELEVENLABS_MODEL, createSynthesize } from './speech/elevenlabs';
import { FakeScriptError } from './recognition/fake';
import { RECOGNITION_TEMPLATE_PATH, type Recognizer, createGeminiRecognizer } from './recognition/gemini';

class StartError extends Error {}

/** With MONGODB_URI the products come from the database. Without it they come from the catalog file. */
async function openStore(config: Config): Promise<Store> {
  if (config.mongodbUri === null) return new MemoryStore(readCatalogFile(config.catalogPath));
  const store = await MongoStore.connect(config.mongodbUri, config.mongodbDb);
  if ((await store.listProducts()).length === 0) {
    await store.close();
    throw new StartError('products is empty. Run npm run catalog:seed.');
  }
  return store;
}

/** The real recognizer, or undefined with fake recognition. loadConfig has checked that the key exists. */
function openRecognizer(config: Config, catalog: CatalogIndex): Recognizer | undefined {
  if (config.fakeRecognition !== null || config.geminiApiKey === null) return undefined;
  return createGeminiRecognizer({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    mediaResolution: config.geminiMediaResolution,
    minConfidence: config.minConfidence,
    catalog,
    template: readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8'),
  });
}

async function main(): Promise<void> {
  const config = loadConfig(process.env, process.argv.slice(2));
  const store = await openStore(config);
  const catalog = indexCatalog(await store.listProducts());
  const recognizer = openRecognizer(config, catalog);
  // loadConfig has checked that the key exists when FAKE_SPEECH is off.
  const synthesize = config.fakeSpeech || config.elevenlabsApiKey === null ? undefined : createSynthesize(config.elevenlabsApiKey);
  const app = await buildApp({
    config, clock: systemClock, store, catalog, ...(recognizer ? { recognizer } : {}), ...(synthesize ? { synthesize } : {}),
  });
  app.addHook('onClose', () => store.close());
  app.log.info(`store: ${config.mongodbUri === null ? 'memory' : 'mongo'}`);
  app.log.info(`catalog: ${catalog.products.length} products`);
  app.log.info(config.fakeRecognition === null
    ? `recognition: ${config.geminiModel}, blur ${config.requireBlur ? 'required' : 'not required'}`
    : `recognition: fake, script ${config.fakeRecognition}`);

  app.log.info(config.fakeSpeech ? 'speech: fake' : `speech: ${ELEVENLABS_MODEL}, clips in ${config.speechCacheDir}`);

  let closing = false;
  const close = (signal: string): void => {
    if (closing) return;
    closing = true;
    app.log.info(`${signal} received, closing`);
    app.close().then(() => process.exit(0), (error) => {
      app.log.error(error);
      process.exit(1);
    });
  };
  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT', () => close('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.port });
  app.log.info(`listening on :${config.port}`);
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    console.error(`config: ${error.message}`);
  } else if (error instanceof StartError || error instanceof FakeScriptError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
