// Stores the catalog and makes the speech clips in advance: npm run catalog:seed -- [catalog.json] [--no-clips] [--lang it]
// With no path it reads CATALOG_PATH. Without --no-clips, each clip that the cache does not hold is one paid ElevenLabs call.
// With --lang it, the check also needs each Italian text, and the seed also makes the Italian clips.
import { readFileSync } from 'node:fs';
import type { Lang } from '@glance/shared';
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
  const { values, positionals } = parseArgs({
    options: { 'no-clips': { type: 'boolean' }, lang: { type: 'string' } }, allowPositionals: true,
  });
  const noClips = values['no-clips'] === true;
  if (values.lang !== undefined && values.lang !== 'en' && values.lang !== 'it') {
    throw new Error(`--lang must be "en" or "it". Got "${values.lang}".`);
  }
  // English is the language of the default profile, so each seed makes its clips.
  const langs: Lang[] = values.lang === 'it' ? ['en', 'it'] : ['en'];
  // The seed makes no recognition call, so it needs no Gemini key. With --no-clips it needs no ElevenLabs key.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', ...(noClips ? { FAKE_SPEECH: '1' } : {}) }, []);
  const path = positionals[0] ?? config.catalogPath;

  const report = checkCatalog(JSON.parse(readFileSync(path, 'utf8')), values.lang === undefined ? {} : { lang: values.lang });
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
      if (langs.includes('it') && config.voiceId.it === null) {
        console.log('seed: ELEVENLABS_VOICE_IT is not set, the Italian clips get the English voice');
      }
      const clipUrl = createClipUrl({
        fake: false,
        cache: new ClipCache(config.speechCacheDir, store),
        synthesize: createSynthesize(config.elevenlabsApiKey),
        voiceId: config.voiceId,
        publicBaseUrl: config.publicBaseUrl,
      });
      for (const lang of langs) {
        const lines = seedLines(products, lang);
        const chars = lines.reduce((sum, line) => sum + line.length, 0);
        console.log(`seed: ${lang}: ${lines.length} lines with ${chars} characters. A line that has a clip in ${config.speechCacheDir} makes no call.`);
        const result = await makeClips(lines, clipUrl, lang);
        clips = { made: clips.made + result.made, failed: clips.failed + result.failed };
      }
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
