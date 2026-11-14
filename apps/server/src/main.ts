import { readFileSync } from 'node:fs';
import { ANSWERS_TEMPLATE_PATH, answerQuestion } from './ask/ask';
import { createGeminiGenerate } from './ask/gemini';
import { type AppDeps, buildApp } from './app';
import { type CatalogIndex, indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { type Config, ConfigError, loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { MongoStore } from './db/mongo';
import type { Store } from './db/store';
import { LABEL_TEMPLATE_PATH, createGeminiLabelReader } from './label/gemini';
import type { LabelReader } from './label/reader';
import { createFakeProductInfo } from './products/fakeProductInfo';
import { createOpenFoodFactsInfo } from './products/openFoodFacts';
import type { ProductInfo } from './products/productInfo';
import { priceConflicts } from './products/resolver';
import { type StoreEntry, readStoreEntries } from './products/storeEntries';
import { type StoreList, readStoreListFile } from './products/storeList';
import { ELEVENLABS_MODEL, createSynthesize } from './speech/elevenlabs';
import { FakeScriptError } from './recognition/fake';
import { RECOGNITION_TEMPLATE_PATH, type Recognizer, createGeminiRecognizer } from './recognition/gemini';
import { createFrameSaver } from './recognition/save';

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

/** The reader of label stills, or undefined with fake recognition. It uses the key and the model of recognition. */
function openLabelReader(config: Config, entries: readonly StoreEntry[]): LabelReader | undefined {
  if (config.fakeRecognition !== null || config.geminiApiKey === null) return undefined;
  return createGeminiLabelReader({
    apiKey: config.geminiApiKey, model: config.geminiModel, template: readFileSync(LABEL_TEMPLATE_PATH, 'utf8'), entries,
  });
}

function openStoreList(config: Config): StoreList {
  try {
    return readStoreListFile(config.storeListPath);
  } catch (error) {
    throw new StartError((error as Error).message);
  }
}

function openProductInfo(config: Config): ProductInfo {
  if (config.fakeProductInfo) return createFakeProductInfo();
  return createOpenFoodFactsInfo({ baseUrl: config.offBaseUrl, userAgent: config.productInfoUserAgent, cacheDir: config.productCacheDir });
}

/** The answers to spoken questions, or undefined with fake recognition. It uses the key and the model of recognition. */
function openAsk(config: Config): AppDeps['ask'] {
  if (config.fakeRecognition !== null || config.geminiApiKey === null) return undefined;
  const generate = createGeminiGenerate({ apiKey: config.geminiApiKey, model: config.geminiModel });
  const template = readFileSync(ANSWERS_TEMPLATE_PATH, 'utf8');
  return (question, product, lang) => answerQuestion(generate, template, { question, product, lang });
}

async function main(): Promise<void> {
  const config = loadConfig(process.env, process.argv.slice(2));
  const store = await openStore(config);
  const catalog = indexCatalog(await store.listProducts());
  const recognizer = openRecognizer(config, catalog);
  const ask = openAsk(config);
  const storeList = openStoreList(config);
  const productInfo = openProductInfo(config);
  // One read of the store list for the whole run: the label reader builds its instruction from it.
  const storeEntries = await readStoreEntries(storeList, productInfo, (line) => console.error(line));
  const storeItems = storeEntries.map((entry) => entry.item);
  const labelReader = openLabelReader(config, storeEntries);
  // loadConfig has checked that the key exists when FAKE_SPEECH is off.
  const synthesize = config.fakeSpeech || config.elevenlabsApiKey === null ? undefined : createSynthesize(config.elevenlabsApiKey);
  const app = await buildApp({
    config, clock: systemClock, store, catalog, storeList, productInfo,
    ...(recognizer ? { recognizer } : {}), ...(labelReader ? { labelReader } : {}), ...(ask ? { ask } : {}), ...(synthesize ? { synthesize } : {}),
    ...(config.saveFramesDir === null ? {} : { saveFrame: createFrameSaver(config.saveFramesDir) }),
  });
  app.addHook('onClose', () => store.close());
  app.log.info(`store: ${config.mongodbUri === null ? 'memory' : 'mongo'}`);
  app.log.info(`catalog: ${catalog.products.length} products`);
  app.log.info(`store list: ${config.storeListPath}, ${storeItems.length} items`);
  app.log.info(config.fakeProductInfo ? 'product info: fake' : `product info: ${config.offBaseUrl}, cache in ${config.productCacheDir}`);
  for (const line of priceConflicts(catalog.products, storeItems)) app.log.warn(line);
  app.log.info(config.fakeRecognition === null
    ? `recognition: ${config.geminiModel}, blur ${config.requireBlur ? 'required' : 'not required'}`
    : `recognition: fake, script ${config.fakeRecognition}`);

  if (config.saveFramesDir !== null) app.log.warn(`SAVE_FRAMES is on. The server writes each frame to ${config.saveFramesDir}.`);
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
