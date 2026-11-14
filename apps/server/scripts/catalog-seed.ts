// Stores the catalog and makes the speech clips in advance: npm run catalog:seed -- [catalog.json] [--no-clips]
// With no path it reads CATALOG_PATH. Without --no-clips, each clip that the cache does not hold is one paid ElevenLabs call.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checkCatalog, reportLines } from '../src/catalog/check';
import { loadConfig } from '../src/config';
import { MemoryStore } from '../src/db/memory';
import { MongoStore } from '../src/db/mongo';
import type { Store } from '../src/db/store';
import { ClipCache } from '../src/speech/clips';
import { createSynthesize } from '../src/speech/elevenlabs';
import { makeClips, seedLines } from '../src/speech/seed';
import { createClipUrl } from '../src/speech/service';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ options: { 'no-clips': { type: 'boolean' } }, allowPositionals: true });
  const noClips = values['no-clips'] === true;
  // The seed makes no recognition call, so it needs no Gemini key. With --no-clips it needs no ElevenLabs key.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', ...(noClips ? { FAKE_SPEECH: '1' } : {}) }, []);
  const path = positionals[0] ?? config.catalogPath;

  const report = checkCatalog(JSON.parse(readFileSync(path, 'utf8')));
  for (const line of reportLines(report)) console.log(line);
  if (report.errors.length > 0) {
    process.exitCode = 1;
    return;
  }
  const { products } = report;

  let store: Store;
  if (config.mongodbUri === null) {
    console.log('seed: no MONGODB_URI, products not stored');
    store = new MemoryStore(products);
  } else {
    store = await MongoStore.connect(config.mongodbUri, config.mongodbDb);
    await store.replaceProducts(products);
  }

  try {
    let clips = { made: 0, failed: 0 };
    if (noClips) {
      console.log('seed: --no-clips is set, no clip made');
    } else if (config.fakeSpeech || config.elevenlabsApiKey === null) {
      console.log('seed: FAKE_SPEECH is on, no clip made');
    } else {
      const lines = seedLines(products);
      const chars = lines.reduce((sum, line) => sum + line.length, 0);
      console.log(`seed: ${lines.length} lines with ${chars} characters. A line that has a clip in ${config.speechCacheDir} makes no call.`);
      clips = await makeClips(lines, createClipUrl({
        fake: false,
        cache: new ClipCache(config.speechCacheDir, store),
        synthesize: createSynthesize(config.elevenlabsApiKey),
        voiceId: config.voiceId,
        publicBaseUrl: config.publicBaseUrl,
      }));
    }
    console.log(`seed: ${products.length} products, ${clips.made} clips, ${clips.failed} failed`);
    if (clips.failed > 0) process.exitCode = 1;
  } finally {
    await store.close();
  }
}

main().catch((error: Error) => {
  console.error(`catalog:seed failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
