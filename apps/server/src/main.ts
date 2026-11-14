import { readFileSync } from 'node:fs';
import type { Part } from '@google/genai';
import { ANSWERS_TEMPLATE_PATH, answerQuestion } from './ask/ask';
import { createGeminiGenerate } from './ask/gemini';
import { type AppDeps, buildApp } from './app';
import { normalizeGtin } from '@glance/shared';
import { type CatalogIndex, indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { type Config, ConfigError, loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { MongoStore } from './db/mongo';
import type { Store } from './db/store';
import { LABEL_TEMPLATE_PATH, createGeminiLabelReader } from './label/gemini';
import type { LabelReader } from './label/reader';
import { OBSERVE_TEMPLATE_PATH, createGeminiObserver } from './observe/gemini';
import { createObservePipeline } from './observe/pipeline';
import { VERIFY_TEMPLATE_PATH, createGeminiVerifier } from './observe/verify';
import { createFakeProductInfo } from './products/fakeProductInfo';
import { createOpenFoodFactsInfo } from './products/openFoodFacts';
import type { ProductInfo } from './products/productInfo';
import { priceConflicts } from './products/resolver';
import { scannedProductId } from './products/scanned';
import { type StoreEntry, notInCatalog, readStoreEntries } from './products/storeEntries';
import { type StoreList, readStoreListFile } from './products/storeList';
import { ELEVENLABS_MODEL, createSynthesize } from './speech/elevenlabs';
import { FakeScriptError } from './recognition/fake';
import { RECOGNITION_TEMPLATE_PATH, type Recognizer, createGeminiRecognizer } from './recognition/gemini';
import { createFrameReferences, createPictureUploader, refreshOnChange, sharePictureParts } from './recognition/references';
import { createFrameSaver } from './recognition/save';
import { type ReferenceImages, createFolderReferences } from './reference/images';
import { type ProductSearch, createProductSearch } from './search/productSearch';

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
function openRecognizer(
  config: Config, catalog: CatalogIndex, entries: readonly StoreEntry[], references: () => readonly Part[],
): Recognizer | undefined {
  if (config.fakeRecognition !== null || config.geminiApiKey === null) return undefined;
  return createGeminiRecognizer({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    mediaResolution: config.geminiMediaResolution,
    minConfidence: config.minConfidence,
    catalog,
    storeEntries: notInCatalog(entries, catalog.products),
    template: readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8'),
    references,
  });
}

/**
 * The recognizer of each session for RECOGNITION_PIPELINE=observe, or undefined for the frame pipeline and with fake
 * recognition. The observe call and the verify call use the key and the model of recognition.
 * A catalog product with a code of the store list keeps its catalog ID, as a barcode gives it.
 */
function openObservePipeline(
  config: Config, catalog: CatalogIndex, entries: readonly StoreEntry[], search: ProductSearch, references: ReferenceImages,
  log: (line: string) => void,
): AppDeps['recognizerFor'] {
  if (config.recognitionPipeline !== 'observe' || config.fakeRecognition !== null || config.geminiApiKey === null) return undefined;
  const catalogIds = new Map(catalog.products.flatMap((product) => {
    const gtin = product.gtin === undefined ? null : normalizeGtin(product.gtin);
    return gtin === null ? [] : [[gtin, product.id] as const];
  }));
  const pipeline = createObservePipeline({
    observer: createGeminiObserver({
      apiKey: config.geminiApiKey, model: config.geminiModel, mediaResolution: config.geminiMediaResolution,
      template: readFileSync(OBSERVE_TEMPLATE_PATH, 'utf8'), withBox: true,
    }),
    verifier: createGeminiVerifier({ apiKey: config.geminiApiKey, model: config.geminiModel, template: readFileSync(VERIFY_TEMPLATE_PATH, 'utf8'), search }),
    search, entries, references,
    productIdOf: (gtin) => catalogIds.get(gtin) ?? scannedProductId(gtin),
    clock: systemClock, minVerifyConfidence: config.verifyMinConfidence, log,
  });
  return (sessionId) => pipeline.forSession(sessionId);
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
  const ask = openAsk(config);
  const storeList = openStoreList(config);
  const productInfo = openProductInfo(config);
  // One read of the store list for the whole run: recognition and the label reader build their instructions from it.
  const storeEntries = await readStoreEntries(storeList, productInfo, (line) => console.error(line));
  const storeItems = storeEntries.map((entry) => entry.item);
  const search = createProductSearch(storeEntries);
  // Fake recognition makes no frame call, so it gets no part and no upload. The observe pipeline sends no picture
  // with a frame: its verify call reads the pictures of its candidates from the folder.
  const frameCallKey = config.fakeRecognition === null && config.recognitionPipeline === 'frame' ? config.geminiApiKey : null;
  const folder = createFolderReferences(config.referenceDir, systemClock);
  // The app does not exist yet, and a line of the first read must go to its log.
  let logReferences: (line: string) => void = (line) => console.error(line);
  // The frame calls and the label calls share the upload of each picture.
  const picturePart = frameCallKey === null ? null : sharePictureParts(createPictureUploader({ apiKey: frameCallKey }), systemClock);
  const frameReferences = createFrameReferences({
    store: folder, entries: storeEntries, products: catalog.products, dir: config.referenceDir, clock: systemClock,
    perItem: frameCallKey === null ? 0 : config.recognitionReferences,
    ...(picturePart === null ? {} : { picturePart }),
    log: (line) => logReferences(line),
  });
  // The app does not exist yet, as for the reference pictures.
  let logPipeline: (line: string) => void = (line) => console.error(line);
  const recognizerFor = openObservePipeline(config, catalog, storeEntries, search, folder, (line) => logPipeline(line));
  const recognizer = recognizerFor ? undefined : openRecognizer(config, catalog, storeEntries, frameReferences.current);
  const labelReader = openLabelReader(config, storeEntries);
  // loadConfig has checked that the key exists when FAKE_SPEECH is off.
  const synthesize = config.fakeSpeech || config.elevenlabsApiKey === null ? undefined : createSynthesize(config.elevenlabsApiKey);
  const app = await buildApp({
    config, clock: systemClock, store, catalog, storeList, productInfo, storeEntries,
    references: refreshOnChange(folder, frameReferences),
    ...(picturePart === null ? {} : { picturePart }),
    ...(recognizer ? { recognizer } : {}), ...(recognizerFor ? { recognizerFor } : {}), ...(labelReader ? { labelReader } : {}), ...(ask ? { ask } : {}), ...(synthesize ? { synthesize } : {}),
    ...(config.saveFramesDir === null ? {} : { saveFrame: createFrameSaver(config.saveFramesDir) }),
    // The warm-up read the product again: the search index takes its names of each language.
    onProductRead: async (gtin) => {
      const item = await storeList.byGtin(gtin);
      if (item) search.put({ item, details: await productInfo.cached(gtin) });
    },
  });
  logPipeline = (line) => app.log.info(line);
  app.addHook('onClose', () => store.close());
  app.log.info(`store: ${config.mongodbUri === null ? 'memory' : 'mongo'}`);
  app.log.info(`catalog: ${catalog.products.length} products`);
  app.log.info(`store list: ${config.storeListPath}, ${storeItems.length} items`);
  logReferences = (line) => app.log.info(line);
  // The first read logs the pictures. A later change of the folder gets the same line again.
  await frameReferences.refresh();
  app.log.info(config.fakeProductInfo ? 'product info: fake' : `product info: ${config.offBaseUrl}, cache in ${config.productCacheDir}`);
  for (const line of priceConflicts(catalog.products, storeItems)) app.log.warn(line);
  app.log.info(config.fakeRecognition === null
    ? `recognition: ${config.geminiModel}, pipeline ${config.recognitionPipeline}, blur ${config.requireBlur ? 'required' : 'not required'}`
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
