// Sends the frames of a test set to the real recognition service and prints an accuracy table:
//   npm run replay -- --frames <dir> [--media-resolution default|low] [--min-confidence <n>] [--limit <n>]
// The frames lie in <dir>/<label>/<name>.jpg. A label is a product ID, "unknown", or "none".
// Each frame is one paid Gemini call. The exit code is 1 when a frame got the name of a wrong product.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { TIMING } from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../src/catalog/catalog';
import { loadConfig } from '../src/config';
import { RECOGNITION_TEMPLATE_PATH, createGeminiRecognizer } from '../src/recognition/gemini';
import { formatTable, limitFrames, listFrames, replayFrames, summarize } from '../src/recognition/replay';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      frames: { type: 'string' }, 'media-resolution': { type: 'string' },
      'min-confidence': { type: 'string' }, limit: { type: 'string' },
    },
  });
  if (values.frames === undefined) throw new Error('--frames <dir> is not set.');
  const limit = values.limit === undefined ? null : Number(values.limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error(`--limit must be an integer of 1 or more. Got "${values.limit}".`);

  // The fake switches have no effect here: this script exists to call the real service.
  // loadConfig checks the two options with the rules of their variables.
  const config = loadConfig({
    ...process.env, FAKE_RECOGNITION: '1', FAKE_SPEECH: '1',
    ...(values['media-resolution'] === undefined ? {} : { GEMINI_MEDIA_RESOLUTION: values['media-resolution'] }),
    ...(values['min-confidence'] === undefined ? {} : { RECOGNITION_MIN_CONFIDENCE: values['min-confidence'] }),
  }, []);
  if (config.geminiApiKey === null) throw new Error('GEMINI_API_KEY is not set.');

  const catalog = indexCatalog(readCatalogFile(config.catalogPath));
  const all = listFrames(values.frames, catalog);
  const frames = limit === null ? all : limitFrames(all, limit);
  if (frames.length === 0) throw new Error(`${values.frames} holds no JPEG file in a label folder.`);
  console.log(
    `replay: ${frames.length} of ${all.length} frames, one Gemini call for each. model ${config.geminiModel}, `
    + `media resolution ${config.geminiMediaResolution}, min confidence ${config.minConfidence}, catalog ${config.catalogPath}`,
  );

  const recognizer = createGeminiRecognizer({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    mediaResolution: config.geminiMediaResolution,
    minConfidence: config.minConfidence,
    catalog,
    template: readFileSync(RECOGNITION_TEMPLATE_PATH, 'utf8'),
  });
  const rows = await replayFrames(frames, recognizer, {
    timeoutMs: TIMING.recognitionTimeoutMs,
    onRow: (row) => {
      const answer = row.result === null ? 'failed' : [row.result.status, row.result.productId ?? ''].join(' ').trim();
      console.log(`${row.file}: ${answer}, ${row.ms} ms`);
    },
  });
  const table = summarize(rows);
  console.log(formatTable(table));
  if (table.wrongIdentified > 0) process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`replay failed. ${error.name}: ${error.message}`);
  process.exitCode = 1;
});
