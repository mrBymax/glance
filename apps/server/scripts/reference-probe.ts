// Measures recognition by sight with and without reference pictures, with the real service:
//   npm run reference:probe -- --labels <file.json> [--pictures 0,1,3]
// The labels file: { "expect": "<product ID>", "frames": { "clear": [<jpg path>], "partly": [], "none": [], "other": [] } }.
// A path is relative to the folder of the labels file. `clear` and `partly` show the expected product in a hand,
// `none` shows no product in a hand, and `other` shows another product in a hand.
// Each frame is one paid Gemini call for each value of --pictures. The exit code is 1 when a call named a wrong product.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { GoogleGenAI, type Part } from '@google/genai';
import { TIMING } from '@glance/shared';
import { z } from 'zod';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { systemClock } from '../src/clock';
import { loadConfig } from '../src/config';
import { createOpenFoodFactsInfo } from '../src/products/openFoodFacts';
import { scannedProduct } from '../src/products/scanned';
import { notInCatalog, readStoreEntries } from '../src/products/storeEntries';
import { readStoreListFile } from '../src/products/storeList';
import { RECOGNITION_TEMPLATE_PATH, recognitionParts } from '../src/recognition/gemini';
import { buildSystemInstruction, recognitionResponseSchema } from '../src/recognition/prompt';
import { createPictureUploader, loadFrameReferences } from '../src/recognition/references';
import { normalizeResult } from '../src/recognition/result';
import { createFolderReferences } from '../src/reference/images';

const LABELS = ['clear', 'partly', 'none', 'other'] as const;
type Label = (typeof LABELS)[number];
const LabelsFileSchema = z.object({
  expect: z.string().min(1),
  frames: z.object({ clear: z.array(z.string()), partly: z.array(z.string()), none: z.array(z.string()), other: z.array(z.string()) }),
}).strict();

type Row = {
  pictures: number; label: Label; file: string; ms: number; promptTokens: number | null;
  /** null: the call failed or took more than the time limit. */
  answer: { status: string; productId: string | null; confidence: number; rawStatus: string; rawProductId: string | null } | null;
};

const percentile = (sorted: readonly number[], share: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * share) - 1)]!;

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { labels: { type: 'string' }, pictures: { type: 'string' }, upload: { type: 'boolean' } } });
  if (values.labels === undefined) throw new Error('--labels <file.json> is not set.');
  const pictureCounts = (values.pictures ?? '0,1,3').split(',').map(Number);
  if (pictureCounts.some((count) => !Number.isInteger(count) || count < 0)) throw new Error(`--pictures must be a list of integers. Got "${values.pictures}".`);

  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');
  const labels = LabelsFileSchema.parse(JSON.parse(readFileSync(values.labels, 'utf8')));
  const frames = LABELS.flatMap((label) => labels.frames[label].map((file) => ({ label, file })));

  const catalog = indexCatalog(readCatalogFile(config.catalogPath));
  // The details come from the cache files alone, as at the start of the server. The script makes no call to Open Food Facts.
  const info = createOpenFoodFactsInfo({ baseUrl: config.offBaseUrl, userAgent: config.productInfoUserAgent, cacheDir: config.productCacheDir });
  const entries = await readStoreEntries(readStoreListFile(config.storeListPath), info, (line) => console.error(line));
  const storeEntries = notInCatalog(entries, catalog.products);
  const known = indexCatalog([...catalog.products, ...storeEntries.map((entry) => scannedProduct(entry.item, entry.details))]);
  const template = readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8');
  const responseSchema = recognitionResponseSchema(known.products.map((product) => product.id));
  const store = createFolderReferences(config.referenceDir, systemClock);

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const uploader = values.upload ? createPictureUploader({ apiKey: config.geminiApiKey }) : undefined;
  const variants = await Promise.all(pictureCounts.map(async (pictures) => {
    const loaded = await loadFrameReferences(store, entries, catalog.products, pictures, undefined, uploader);
    return {
      pictures, parts: loaded.parts,
      systemInstruction: buildSystemInstruction(template, catalog.products, storeEntries, loaded.parts.length > 0),
    };
  }));
  console.log(
    `reference probe: ${frames.length} frames, ${variants.length} calls for each. model ${config.geminiModel}, `
    + `catalog ${config.catalogPath}, store list ${config.storeListPath}, reference pictures ${config.referenceDir}`,
  );
  for (const variant of variants) console.log(`pictures for each item: ${variant.pictures}, image parts: ${variant.parts.filter((part: Part) => part.inlineData ?? part.fileData).length}`);

  const rows: Row[] = [];
  for (const frame of frames) {
    const jpeg = readFileSync(resolve(dirname(values.labels), frame.file));
    // One call at a time, and each frame gets its calls one after the other, so a slow minute of the service counts for each variant.
    for (const variant of variants) {
      const startedAt = performance.now();
      let answer: Row['answer'] = null;
      let promptTokens: number | null = null;
      try {
        const response = await ai.models.generateContent({
          model: config.geminiModel,
          contents: recognitionParts(jpeg, [], variant.parts),
          config: {
            systemInstruction: variant.systemInstruction, responseMimeType: 'application/json', responseJsonSchema: responseSchema,
            abortSignal: AbortSignal.timeout(TIMING.recognitionTimeoutMs), httpOptions: { retryOptions: { attempts: 1 } },
          },
        });
        promptTokens = response.usageMetadata?.promptTokenCount ?? null;
        const raw = JSON.parse(response.text ?? '') as { status?: string; productId?: string | null };
        const result = normalizeResult(raw, { catalog: known, exclude: [], minConfidence: config.minConfidence });
        answer = {
          status: result.status, productId: result.productId, confidence: result.confidence,
          rawStatus: String(raw.status), rawProductId: raw.productId ?? null,
        };
      } catch (error) {
        console.error(`call failed. ${frame.file} pictures=${variant.pictures} ${(error as Error).name}: ${(error as Error).message.slice(0, 200)}`);
      }
      const ms = Math.round(performance.now() - startedAt);
      rows.push({ pictures: variant.pictures, label: frame.label, file: frame.file, ms, promptTokens, answer });
      console.log(
        `pictures=${variant.pictures} label=${frame.label} file=${frame.file} `
        + (answer === null ? 'failed' : `status=${answer.status} id=${answer.productId ?? 'null'} confidence=${answer.confidence} raw=${answer.rawStatus}/${answer.rawProductId ?? 'null'}`)
        + ` ms=${ms} promptTokens=${promptTokens ?? 'none'}`,
      );
    }
  }

  let wrong = 0;
  console.log('pictures  label   frames  identified  unsure  unknown  none  wrong  failed');
  for (const { pictures } of variants) {
    for (const label of LABELS) {
      const of = rows.filter((row) => row.pictures === pictures && row.label === label);
      const withStatus = (status: string): number => of.filter((row) => row.answer?.status === status).length;
      const named = of.filter((row) => row.answer?.productId != null);
      const right = label === 'clear' || label === 'partly' ? named.filter((row) => row.answer!.productId === labels.expect).length : 0;
      wrong += named.length - right;
      console.log([
        String(pictures).padEnd(8), label.padEnd(6), String(of.length).padStart(6), String(right).padStart(10),
        String(withStatus('unsure')).padStart(6), String(withStatus('unknown')).padStart(7), String(withStatus('none')).padStart(4),
        String(named.length - right).padStart(5), String(of.filter((row) => row.answer === null).length).padStart(6),
      ].join('  '));
    }
  }
  for (const { pictures } of variants) {
    const of = rows.filter((row) => row.pictures === pictures);
    const times = of.map((row) => row.ms).sort((a, b) => a - b);
    const tokens = of.flatMap((row) => (row.promptTokens === null ? [] : [row.promptTokens])).sort((a, b) => a - b);
    console.log(`pictures=${pictures}: latency median ${percentile(times, 0.5)} ms, p90 ${percentile(times, 0.9)} ms, prompt tokens median ${tokens.length > 0 ? percentile(tokens, 0.5) : 'none'}`);
  }
  if (wrong > 0) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`reference:probe failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
