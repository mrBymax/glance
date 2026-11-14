import { buildApp } from './app';
import { indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { type Config, ConfigError, loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { MongoStore } from './db/mongo';
import type { Store } from './db/store';
import { FakeScriptError } from './recognition/fake';

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

async function main(): Promise<void> {
  const config = loadConfig(process.env, process.argv.slice(2));
  const store = await openStore(config);
  const catalog = indexCatalog(await store.listProducts());
  const app = await buildApp({ config, clock: systemClock, store, catalog });
  app.addHook('onClose', () => store.close());
  app.log.info(`store: ${config.mongodbUri === null ? 'memory' : 'mongo'}`);
  app.log.info(`catalog: ${catalog.products.length} products`);

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
