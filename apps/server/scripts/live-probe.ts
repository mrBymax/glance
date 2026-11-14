// Measures a Gemini Live session on saved stream frames: npm run live:probe -- --frames <dir> --from <seq> --to <seq>
//   [--form change|pace|tick|activity] [--model <id>] [--first <seq>] [--product <id>] [--tick-ms <n>|loop] [--every <n>]
//   [--media-resolution default|low] [--no-proactive-video] [--per-frame]
// The frames lie in <dir>/<seq>.jpg, as SAVE_FRAMES writes them. The script sends them in order with the gaps of their file times.
// It opens one paid Live session for the length of the frames, and prints each report of the model with its delay.
// `--first` is the first frame that shows the product `--product`: the summary counts the delay from that frame.
// `--per-frame` opens no session: it sends each frame to the per-frame call of the server, one call at a time, for the comparison.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  FunctionResponseScheduling, GoogleGenAI, type LiveConnectConfig, type LiveServerMessage, MediaResolution, Modality, type Session,
} from '@google/genai';
import { TIMING } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { loadConfig } from '../src/config';
import { createFakeProductInfo } from '../src/products/fakeProductInfo';
import { createOpenFoodFactsInfo } from '../src/products/openFoodFacts';
import { scannedProduct } from '../src/products/scanned';
import { notInCatalog, readStoreEntries } from '../src/products/storeEntries';
import { readStoreListFile } from '../src/products/storeList';
import { RECOGNITION_TEMPLATE_PATH, createGeminiRecognizer } from '../src/recognition/gemini';
import { LIVE_FORMS, type LiveForm, REPORT_VIEW, buildLiveInstruction, reportViewDeclaration, resultFromReport } from '../src/recognition/liveReport';
import { buildSystemInstruction } from '../src/recognition/prompt';
import { normalizeResult } from '../src/recognition/result';

/** A file above this size is a still. The stream frames of the phone have 15 to 70 KB. */
const STILL_BYTES = 120_000;
/** A pause of the phone must not hold the paid session open. */
const MAX_GAP_MS = 1000;
/** With `--tick-ms loop`, a request with no report gets a new request after this time. */
const LOOP_WAIT_MS = 2000;
/** The session stays open for this time after the last frame, for the late reports. */
const TAIL_MS = 4000;

type SavedFrame = { seq: number; path: string; at: number };

function listSavedFrames(dir: string, from: number, to: number): SavedFrame[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const seq = /^(\d+)\.jpg$/.exec(name)?.[1];
      if (seq === undefined || Number(seq) < from || Number(seq) > to) return [];
      const path = join(dir, name);
      const stat = statSync(path);
      return stat.size > STILL_BYTES ? [] : [{ seq: Number(seq), path, at: stat.mtimeMs }];
    })
    .sort((a, b) => a.seq - b.seq);
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      frames: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, form: { type: 'string' }, model: { type: 'string' },
      first: { type: 'string' }, product: { type: 'string' }, 'tick-ms': { type: 'string' }, every: { type: 'string' },
      'media-resolution': { type: 'string' }, 'no-proactive-video': { type: 'boolean' }, 'per-frame': { type: 'boolean' },
    },
  });
  if (values.frames === undefined) throw new Error('--frames <dir> is not set.');
  const form = (values.form ?? 'change') as LiveForm;
  if (!LIVE_FORMS.includes(form)) throw new Error(`--form must be one of ${LIVE_FORMS.join(', ')}. Got "${values.form}".`);
  const model = values.model ?? 'gemini-3.8-live';
  // `loop`: the next request goes out when the report of the last one arrived. A number: one request each so many milliseconds.
  const loop = values['tick-ms'] === 'loop';
  const tickMs = loop ? LOOP_WAIT_MS : Number(values['tick-ms'] ?? 1000);
  const every = Number(values.every ?? 1);
  const first = values.first === undefined ? null : Number(values.first);

  // The fake switches have no effect here: this script exists to call the real service.
  const config = loadConfig({ ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1' }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');

  const catalog = indexCatalog(readCatalogFile(config.catalogPath));
  const info = config.fakeProductInfo
    ? createFakeProductInfo()
    : createOpenFoodFactsInfo({ baseUrl: config.offBaseUrl, userAgent: config.productInfoUserAgent, cacheDir: config.productCacheDir });
  // `cached` makes no call to Open Food Facts.
  const storeEntries = notInCatalog(await readStoreEntries(readStoreListFile(config.storeListPath), info, () => undefined), catalog.products);
  const known = indexCatalog([...catalog.products, ...storeEntries.map((entry) => scannedProduct(entry.item, entry.details))]);
  const base = buildSystemInstruction(readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8'), catalog.products, storeEntries);

  const frames = listSavedFrames(values.frames, Number(values.from ?? 0), Number(values.to ?? Number.MAX_SAFE_INTEGER))
    .filter((_frame, index) => index % every === 0);
  if (frames.length === 0) throw new Error(`${values.frames} holds no stream frame in the range.`);

  if (values['per-frame'] === true) {
    const template = readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8');
    const recognizer = createGeminiRecognizer({
      apiKey: config.geminiApiKey, model: config.geminiModel, mediaResolution: config.geminiMediaResolution,
      minConfidence: config.minConfidence, catalog, storeEntries, template,
    });
    console.log(`per-frame calls: model ${config.geminiModel}, ${frames.length} frames ${frames[0]!.seq} to ${frames.at(-1)!.seq}`);
    for (const frame of frames) {
      const callAt = performance.now();
      const answer = await recognizer
        .recognize(readFileSync(frame.path), { exclude: [], still: false, signal: AbortSignal.timeout(TIMING.recognitionTimeoutMs) })
        .then((result) => `status=${result.status} product=${result.productId ?? 'none'} code=${result.code.digits ?? (result.code.visible ? 'visible' : 'no')}`)
        .catch((error: Error) => `failed ${error.name}`);
      console.log(`seq=${frame.seq} ${answer} ms=${Math.round(performance.now() - callAt)}`);
    }
    return;
  }

  const proactiveVideo = (form === 'change' || form === 'pace') && values['no-proactive-video'] !== true;
  const liveConfig: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: buildLiveInstruction(base, form),
    tools: [{ functionDeclarations: [reportViewDeclaration(known.products.map((product) => product.id))] }],
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: {},
    ...(values['media-resolution'] === 'low' ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
    ...(proactiveVideo ? { proactivity: { proactiveAudio: true, proactiveVideo: true } } : {}),
    ...(form === 'activity' ? { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } } : {}),
  };
  console.log(`live probe: model ${model}, form ${form}, ${frames.length} frames ${frames[0]!.seq} to ${frames.at(-1)!.seq}, `
    + `proactiveVideo ${proactiveVideo}, catalog ${config.catalogPath}, store list ${config.storeListPath}`);

  const startedAt = performance.now();
  const since = (): number => Math.round(performance.now() - startedAt);
  const sentAt = new Map<number, number>();
  let newest = 0;
  let audioBytes = 0;
  let handles = 0;
  let tokens = 0;
  let closed: string | null = null;
  const reports: { ms: number; seq: number; status: string; productId: string | null }[] = [];
  // The callbacks can run before connect resolves.
  let session: Session | null = null;
  let ticks: NodeJS.Timeout | null = null;
  let ended = false;
  const tick = (): void => {
    if (closed !== null || ended) return;
    session?.sendRealtimeInput({ text: 'report' });
    if (ticks) clearTimeout(ticks);
    ticks = setTimeout(tick, tickMs);
  };

  const onMessage = (message: LiveServerMessage): void => {
    if (message.setupComplete) console.log(`${since()} ms setup complete`);
    for (const call of message.toolCall?.functionCalls ?? []) {
      const result = normalizeResult(resultFromReport(call.args), { catalog: known, exclude: [], minConfidence: config.minConfidence });
      const afterFrame = Math.round(performance.now() - startedAt - (sentAt.get(newest) ?? 0));
      const afterFirst = first !== null && sentAt.has(first) ? ` afterFirst=${since() - sentAt.get(first)!}` : '';
      reports.push({ ms: since(), seq: newest, status: result.status, productId: result.productId });
      console.log(`${since()} ms report newestSeq=${newest} afterNewest=${afterFrame}${afterFirst} status=${result.status} `
        + `product=${result.productId ?? 'none'} args=${JSON.stringify(call.args)}`);
      // SILENT: the answer goes to the context, and the model starts no turn for it.
      session?.sendToolResponse({
        functionResponses: { id: call.id!, name: call.name ?? REPORT_VIEW, response: { output: 'ok' }, scheduling: FunctionResponseScheduling.SILENT },
      });
      if (loop) tick();
    }
    if (message.toolCallCancellation) console.log(`${since()} ms calls cancelled ${JSON.stringify(message.toolCallCancellation.ids)}`);
    const content = message.serverContent;
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) audioBytes += Buffer.from(part.inlineData.data, 'base64').length;
      if (part.text) console.log(`${since()} ms text ${JSON.stringify(part.text.slice(0, 200))}`);
    }
    if (content?.turnComplete) console.log(`${since()} ms turn complete`);
    if (content?.interrupted) console.log(`${since()} ms interrupted`);
    if (message.usageMetadata) {
      const usage = message.usageMetadata;
      tokens = Math.max(tokens, usage.totalTokenCount ?? 0);
      console.log(`${since()} ms usage prompt=${usage.promptTokenCount ?? 0} response=${usage.responseTokenCount ?? 0} `
        + `thoughts=${usage.thoughtsTokenCount ?? 0} total=${usage.totalTokenCount ?? 0}`);
    }
    if (message.goAway) console.log(`${since()} ms goAway timeLeft=${message.goAway.timeLeft}`);
    if (message.sessionResumptionUpdate?.newHandle) handles += 1;
  };

  // The Live samples of the documentation set the version. Without it, the socket of @google/genai 3.3.0 answered 404.
  session = await new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { apiVersion: 'v1beta' } }).live.connect({
    model,
    config: liveConfig,
    callbacks: {
      onmessage: onMessage,
      onerror: (event) => console.log(`${since()} ms socket error ${String(event.message).slice(0, 300)}`),
      onclose: (event) => {
        closed = `code=${event.code} reason=${String(event.reason).slice(0, 300)}`;
        console.log(`${since()} ms socket closed ${closed}`);
      },
    },
  });
  console.log(`${since()} ms connected`);

  if (form === 'tick') ticks = setTimeout(tick, loop ? 0 : tickMs);
  for (const [index, frame] of frames.entries()) {
    if (closed !== null) break;
    if (index > 0) await sleep(Math.min(MAX_GAP_MS, Math.max(0, frame.at - frames[index - 1]!.at)));
    const video = { data: readFileSync(frame.path).toString('base64'), mimeType: 'image/jpeg' };
    if (form === 'activity') session.sendRealtimeInput({ activityStart: {} });
    session.sendRealtimeInput({ video });
    if (form === 'activity') session.sendRealtimeInput({ activityEnd: {} });
    newest = frame.seq;
    sentAt.set(frame.seq, since());
  }
  await sleep(TAIL_MS);
  ended = true;
  if (ticks) clearTimeout(ticks);
  const openMs = since();
  session.close();

  const named = values.product === undefined ? [] : reports.filter((report) => report.productId === values.product);
  const other = reports.filter((report) => report.status === 'identified' && report.productId !== values.product);
  const early = first === null ? [] : named.filter((report) => report.seq < first);
  const firstNamed = first === null ? undefined : named.find((report) => report.seq >= first);
  console.log(`summary: open ${openMs} ms, reports ${reports.length}, named ${named.length}, named before frame ${first ?? 'none'}: ${early.length}, `
    + `other product named ${other.length}, first name after frame ${first ?? 'none'}: `
    + `${firstNamed && first !== null ? `${firstNamed.ms - sentAt.get(first)!} ms` : 'none'}, `
    + `audio ${audioBytes} bytes, resumption handles ${handles}, tokens ${tokens}`);
}

main().catch((error: Error) => {
  console.error(`live:probe failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
