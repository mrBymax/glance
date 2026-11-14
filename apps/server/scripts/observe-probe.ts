// Replays labeled appearances through the observe pipeline with the real service, at the speed of the session:
//   npm run observe:probe -- --appearances <file.json> [--only <text>] [--every <n>] [--concurrency <n>] [--out <rows.jsonl>]
// The file: { "appearances": [{ "id": "<name>", "product": "<product ID>" | "other" | null, "firstHeld": <seq> | null,
//   "frames": [{ "file": "<jpg path>", "seq": <n>, "t": <arrival time in ms> }] }] }.
// `product` is the store item in the hand, "other" for a product that the store does not sell, and null for no product.
// `firstHeld` is the first frame that shows the product in the hand. Each frame goes to the recognition worker at its
// time `t`, so the calls overlap as they do in a session. Each frame is one paid observe call, and an appearance can
// add one verify call of up to 3 model calls. The exit code is 1 when an appearance got a wrong name.
import { appendFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { systemClock } from '../src/clock';
import { loadConfig } from '../src/config';
import { OBSERVE_TEMPLATE_PATH, createGeminiObserver } from '../src/observe/gemini';
import { createObservePipeline } from '../src/observe/pipeline';
import { VERIFY_TEMPLATE_PATH, createGeminiVerifier } from '../src/observe/verify';
import { createOpenFoodFactsInfo } from '../src/products/openFoodFacts';
import { scannedProductId } from '../src/products/scanned';
import { readStoreEntries } from '../src/products/storeEntries';
import { readStoreListFile } from '../src/products/storeList';
import type { RecognitionResult } from '../src/recognition/result';
import { RecognitionWorker } from '../src/recognition/worker';
import { createFolderReferences } from '../src/reference/images';
import { createProductSearch } from '../src/search/productSearch';

const FileSchema = z.object({
  appearances: z.array(z.object({
    id: z.string().min(1), product: z.string().min(1).nullable(), firstHeld: z.number().int().nullable(),
    frames: z.array(z.object({ file: z.string().min(1), seq: z.number().int(), t: z.number() })).min(1),
  })),
});

type Row = { seq: number; atMs: number; doneMs: number; callMs: number; status: RecognitionResult['status']; productId: string | null };

const letter = (row: Row, product: string | null): string => {
  if (row.status === 'identified') return row.productId === product ? 'R' : 'W';
  return { ambiguous: 'a', unsure: 'u', unknown: 'k', none: '.' }[row.status];
};

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { appearances: { type: 'string' }, only: { type: 'string' }, every: { type: 'string' }, concurrency: { type: 'string' }, out: { type: 'string' } },
  });
  if (values.appearances === undefined) throw new Error('--appearances <file.json> is not set.');
  const every = Number(values.every ?? 1);
  if (!Number.isInteger(every) || every < 1) throw new Error(`--every must be an integer above 0. Got "${values.every}".`);

  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');
  const concurrency = values.concurrency === undefined ? config.recognitionConcurrency : Number(values.concurrency);
  const catalog = indexCatalog(readCatalogFile(config.catalogPath));
  // The details come from the cache files alone, as at the start of the server. The script makes no call to Open Food Facts.
  const info = createOpenFoodFactsInfo({ baseUrl: config.offBaseUrl, userAgent: config.productInfoUserAgent, cacheDir: config.productCacheDir });
  const entries = await readStoreEntries(readStoreListFile(config.storeListPath), info, (line) => console.error(line));
  const search = createProductSearch(entries);
  let modelCalls = 0;
  const counting: typeof fetch = (input, init) => {
    modelCalls += 1;
    return fetch(input, init);
  };
  const lines: string[] = [];
  const pipeline = createObservePipeline({
    observer: createGeminiObserver({
      apiKey: config.geminiApiKey, model: config.geminiModel, mediaResolution: config.geminiMediaResolution,
      template: readFileSync(OBSERVE_TEMPLATE_PATH, 'utf8'), withBox: true, fetch: counting,
    }),
    verifier: createGeminiVerifier({ apiKey: config.geminiApiKey, model: config.geminiModel, template: readFileSync(VERIFY_TEMPLATE_PATH, 'utf8'), search, fetch: counting }),
    search, entries, references: createFolderReferences(config.referenceDir, systemClock),
    productIdOf: (gtin) => catalog.products.find((product) => product.gtin === gtin)?.id ?? scannedProductId(gtin),
    clock: systemClock, minVerifyConfidence: config.verifyMinConfidence, log: (line) => lines.push(line),
  });

  const { appearances } = FileSchema.parse(JSON.parse(readFileSync(values.appearances, 'utf8')));
  const selected = appearances.filter((appearance) => values.only === undefined || appearance.id.includes(values.only));
  console.log(`observe probe: ${selected.length} appearances, each ${every}. frame, ${concurrency} calls at a time, model ${config.geminiModel}, store list ${config.storeListPath}`);
  let wrongNames = 0;
  for (const appearance of selected) {
    const frames = appearance.frames.filter((_, index) => index % every === 0);
    const rows: Row[] = [];
    const callsBefore = modelCalls;
    lines.length = 0;
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      let open = frames.length;
      const closed = (): void => {
        open -= 1;
        if (open === 0) resolve();
      };
      const submitted = new Map<number, number>();
      const worker = new RecognitionWorker({
        recognizer: pipeline.forSession(appearance.id), concurrency, exclude: () => [], onSlow: () => undefined,
        onResult: (result, { seq, ms }) => {
          rows.push({ seq, atMs: submitted.get(seq)!, doneMs: Math.round(performance.now() - startedAt), callMs: ms, status: result.status, productId: result.productId });
        },
      });
      for (const frame of frames) {
        setTimeout(() => {
          submitted.set(frame.seq, Math.round(performance.now() - startedAt));
          worker.submit({ header: { seq: frame.seq, ts: frame.t, w: 1, h: 1, blurred: true }, jpeg: new Uint8Array(readFileSync(frame.file)) });
          // The worker reports only the results that reach the rules. Each call ends inside its 4 seconds.
          setTimeout(closed, 4500);
        }, frame.t - frames[0]!.t);
      }
    });
    rows.sort((a, b) => a.doneMs - b.doneMs);
    const heldAt = appearance.firstHeld === null ? null : frames.find((frame) => frame.seq >= appearance.firstHeld!)!.t - frames[0]!.t;
    const named = rows.filter((row) => row.status === 'identified');
    const right = named.find((row) => row.productId === appearance.product);
    const wrong = named.filter((row) => row.productId !== appearance.product).length;
    wrongNames += wrong;
    const calls = rows.map((row) => row.callMs).sort((a, b) => a - b);
    console.log(
      `${appearance.id.padEnd(14)} ${rows.map((row) => letter(row, appearance.product)).join('').padEnd(30)} frames=${frames.length} results=${rows.length} modelCalls=${modelCalls - callsBefore}`
      + ` medianCallMs=${calls[calls.length >> 1] ?? 'none'}`
      + (appearance.product === null || heldAt === null ? '' : right ? ` firstRightNameMs=${right.doneMs - heldAt} (frame ${right.seq})` : ' firstRightNameMs=none')
      + (wrong === 0 ? '' : ` WRONG=${wrong}`),
    );
    for (const line of lines) console.log(`    ${line}`);
    if (values.out !== undefined) appendFileSync(values.out, `${JSON.stringify({ id: appearance.id, product: appearance.product, heldAt, rows, lines, modelCalls: modelCalls - callsBefore })}\n`);
  }
  console.log(`model calls: ${modelCalls}. wrong names: ${wrongNames}`);
  if (wrongNames > 0) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`observe:probe failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
