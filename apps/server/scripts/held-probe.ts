// Measures recognition by sight on frames that a person labeled, with the real service:
//   npm run held:probe -- --labels <file.json> [--half a|b] [--pictures 3] [--model <id>] [--thinking minimal|low|medium|high]
//     [--frame-resolution low|medium|high|ultra] [--reference-resolution low|medium|high|ultra] [--template <instruction.md>]
//     [--out <rows.jsonl>]
// The labels file: { "frames": [{ "file": "<jpg path>", "held": "<product ID>" | null, "view": "front" | "back" | "part" | "none", "edge": false }] }.
// A path is relative to the folder of the labels file. `held` is the store item that a hand holds, or null.
// `view` says what the frame shows of it: its front, its back or side, or only a part. `none` goes with `held: null`.
// `edge` marks a product that is low in the frame or at its edge.
// Each frame is one paid Gemini call. The exit code is 1 when a call named a wrong product.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { GoogleGenAI, type Part, PartMediaResolutionLevel, ThinkingLevel } from '@google/genai';
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

const LabelsFileSchema = z.object({
  frames: z.array(z.object({
    file: z.string().min(1), held: z.string().min(1).nullable(), view: z.enum(['front', 'back', 'part', 'none']), edge: z.boolean(),
  }).strict()),
}).strict();
type Frame = z.infer<typeof LabelsFileSchema>['frames'][number];

const THINKING = { minimal: ThinkingLevel.MINIMAL, low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH } as const;
const RESOLUTION = {
  low: PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW,
  medium: PartMediaResolutionLevel.MEDIA_RESOLUTION_MEDIUM,
  high: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH,
  ultra: PartMediaResolutionLevel.MEDIA_RESOLUTION_ULTRA_HIGH,
} as const;
type Resolution = keyof typeof RESOLUTION;

type Outcome = 'correct' | 'wrong' | 'ambiguous' | 'unsure' | 'unknown' | 'none' | 'failed';
const OUTCOMES: readonly Outcome[] = ['correct', 'wrong', 'ambiguous', 'unsure', 'unknown', 'none', 'failed'];

type Answer = { status: string; productId: string | null; candidates: string[] };

/**
 * A wrong answer names a product that no hand holds: `identified` with another product, and `ambiguous` with
 * candidates that do not hold the product in the hand. For a frame with no product in a hand, `none` is correct.
 */
function outcomeOf(frame: Pick<Frame, 'held'>, answer: Answer | null): Outcome {
  if (answer === null) return 'failed';
  if (answer.status === 'identified') return answer.productId === frame.held ? 'correct' : 'wrong';
  if (answer.status === 'ambiguous') return frame.held !== null && answer.candidates.includes(frame.held) ? 'ambiguous' : 'wrong';
  if (answer.status === 'none') return frame.held === null ? 'correct' : 'none';
  return answer.status === 'unknown' ? 'unknown' : 'unsure';
}

const percentile = (sorted: readonly number[], share: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * share) - 1)]!;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      labels: { type: 'string' }, half: { type: 'string' }, pictures: { type: 'string' }, model: { type: 'string' },
      thinking: { type: 'string' }, 'frame-resolution': { type: 'string' }, 'reference-resolution': { type: 'string' },
      template: { type: 'string' }, out: { type: 'string' },
    },
  });
  if (values.labels === undefined) throw new Error('--labels <file.json> is not set.');
  if (values.half !== undefined && values.half !== 'a' && values.half !== 'b') throw new Error(`--half must be "a" or "b". Got "${values.half}".`);
  const thinking = values.thinking as keyof typeof THINKING | undefined;
  if (thinking !== undefined && !(thinking in THINKING)) throw new Error(`--thinking must be one of ${Object.keys(THINKING).join(', ')}. Got "${thinking}".`);
  // The server sends a frame with no level, and a reference picture at the level `low`.
  const frameResolution = values['frame-resolution'] as Resolution | 'default' | undefined ?? 'default';
  const referenceResolution = values['reference-resolution'] as Resolution | undefined ?? 'low';
  for (const [flag, level] of [['--frame-resolution', frameResolution], ['--reference-resolution', referenceResolution]] as const) {
    if (level !== 'default' && !(level in RESOLUTION)) throw new Error(`${flag} must be one of ${Object.keys(RESOLUTION).join(', ')}. Got "${level}".`);
  }

  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');
  const model = values.model ?? config.geminiModel;
  const pictures = values.pictures === undefined ? config.recognitionReferences : Number(values.pictures);
  if (!Number.isInteger(pictures) || pictures < 0) throw new Error(`--pictures must be an integer. Got "${values.pictures}".`);

  const groupOf = (frame: Frame): string => (frame.held === null ? 'no product in a hand' : `${frame.held} ${frame.view === 'front' ? 'front' : 'back or part'}`);
  const labeled = LabelsFileSchema.parse(JSON.parse(readFileSync(values.labels, 'utf8'))).frames;
  const groups = [...new Set(labeled.map(groupOf))];
  // A half takes each second frame of each group, so both halves hold each group.
  const frames = groups.flatMap((group) => labeled.filter((frame) => groupOf(frame) === group)
    .filter((_, index) => values.half === undefined || (index % 2 === 0) === (values.half === 'a')));

  const catalog = indexCatalog(readCatalogFile(config.catalogPath));
  // The details come from the cache files alone, as at the start of the server. The script makes no call to Open Food Facts.
  const info = createOpenFoodFactsInfo({ baseUrl: config.offBaseUrl, userAgent: config.productInfoUserAgent, cacheDir: config.productCacheDir });
  const entries = await readStoreEntries(readStoreListFile(config.storeListPath), info, (line) => console.error(line));
  const storeEntries = notInCatalog(entries, catalog.products);
  const known = indexCatalog([...catalog.products, ...storeEntries.map((entry) => scannedProduct(entry.item, entry.details))]);
  const responseSchema = recognitionResponseSchema(known.products.map((product) => product.id));
  const shownCodes = new Set(storeEntries.map((entry) => entry.item.gtin));
  const store = createFolderReferences(config.referenceDir, systemClock);
  const references = (await loadFrameReferences(
    store, entries, catalog.products, pictures, undefined, createPictureUploader({ apiKey: config.geminiApiKey }),
  )).parts.map((part) => (part.fileData ? { ...part, mediaResolution: { level: RESOLUTION[referenceResolution] } } : part));
  const systemInstruction = buildSystemInstruction(
    readFileSync(values.template ?? RECOGNITION_TEMPLATE_PATH, 'utf8'), catalog.products, storeEntries, references.length > 0,
  );
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  console.log(
    `held probe: ${frames.length} frames${values.half === undefined ? '' : `, half ${values.half}`}. model ${model}, thinking ${thinking ?? 'not set'}, `
    + `frame resolution ${frameResolution}, reference resolution ${referenceResolution}, pictures for each item ${pictures}, image parts ${references.filter((part: Part) => part.fileData).length}, `
    + `catalog ${config.catalogPath}, store list ${config.storeListPath}`,
  );

  const rows: { frame: Frame; outcome: Outcome; ms: number; status: string | null; held: boolean | null }[] = [];
  // One call at a time, so the times are those of a call with no other load of this key.
  for (const frame of frames) {
    const jpeg = readFileSync(resolve(dirname(values.labels), frame.file));
    const parts = recognitionParts(jpeg, [], references).map((part) => (
      part.inlineData && frameResolution !== 'default' ? { ...part, mediaResolution: { level: RESOLUTION[frameResolution] } } : part
    ));
    const startedAt = performance.now();
    let answer: Answer | null = null;
    let raw: Record<string, unknown> = {};
    let usage = '';
    try {
      const response = await ai.models.generateContent({
        model,
        contents: parts,
        config: {
          systemInstruction, responseMimeType: 'application/json', responseJsonSchema: responseSchema,
          abortSignal: AbortSignal.timeout(TIMING.recognitionTimeoutMs), httpOptions: { retryOptions: { attempts: 1 } },
          ...(thinking === undefined ? {} : { thinkingConfig: { thinkingLevel: THINKING[thinking] } }),
        },
      });
      usage = ` promptTokens=${response.usageMetadata?.promptTokenCount ?? 'none'} thoughtTokens=${response.usageMetadata?.thoughtsTokenCount ?? 0}`;
      raw = JSON.parse(response.text ?? '') as Record<string, unknown>;
      answer = normalizeResult(raw, { catalog: known, exclude: [], minConfidence: config.minConfidence, shownCodes });
    } catch (error) {
      console.error(`call failed. ${frame.file} ${(error as Error).name}: ${(error as Error).message.slice(0, 200)}`);
    }
    const ms = Math.round(performance.now() - startedAt);
    const outcome = outcomeOf(frame, answer);
    rows.push({ frame, outcome, ms, status: answer?.status ?? null, held: typeof raw.held === 'boolean' ? raw.held : null });
    const line = `${outcome.padEnd(9)} file=${frame.file.split(/[\\/]/).at(-1)} held=${frame.held ?? 'null'} view=${frame.view}${frame.edge ? ' edge' : ''} `
      + `answer=${JSON.stringify(raw)} ms=${ms}${usage}`;
    console.log(line);
    if (values.out !== undefined) appendFileSync(values.out, `${JSON.stringify({ file: frame.file, held: frame.held, view: frame.view, edge: frame.edge, outcome, ms, raw })}\n`);
  }

  const table = (name: string, of: typeof rows): string => [
    name.padEnd(34), String(of.length).padStart(6), ...OUTCOMES.map((outcome) => String(of.filter((row) => row.outcome === outcome).length).padStart(outcome.length + 2)),
  ].join('');
  console.log(['group'.padEnd(34), 'frames', ...OUTCOMES.map((outcome) => `  ${outcome}`)].join(''));
  for (const group of groups) console.log(table(group, rows.filter((row) => groupOf(row.frame) === group)));
  console.log(table('low or at the edge', rows.filter((row) => row.frame.edge)));
  console.log(table('all', rows));
  const unsure = rows.filter((row) => row.status === 'unsure');
  console.log(`unsure answers: ${unsure.length}. held true ${unsure.filter((row) => row.held === true).length}, held false ${unsure.filter((row) => row.held === false).length}`);
  const times = rows.map((row) => row.ms).sort((a, b) => a - b);
  console.log(`latency: median ${percentile(times, 0.5)} ms, p90 ${percentile(times, 0.9)} ms. calls: ${rows.length}`);
  if (rows.some((row) => row.outcome === 'wrong')) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`held:probe failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
