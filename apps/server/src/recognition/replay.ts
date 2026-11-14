import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogIndex } from '../catalog/catalog';
import type { Recognizer } from './gemini';
import type { RecognitionResult } from './result';

/** One frame of the test set. The label is a product ID, 'unknown' (a product outside the catalog), or 'none'. */
export type ReplayFrame = { label: string; file: string };
/** result is null when the call failed. */
export type ReplayRow = { label: string; file: string; result: RecognitionResult | null; ms: number };
export type ReplayLabelRow = {
  label: string; frames: number; correct: number; wrong: number;
  ambiguous: number; unsure: number; unknown: number; none: number; failed: number;
};
export type ReplayTable = {
  rows: ReplayLabelRow[];
  frames: number; correct: number; wrongIdentified: number;
  /** correct / frames, 0 to 1. */
  accuracy: number;
  /** The times of all calls, also of the failed ones. p95 is by nearest rank. */
  medianMs: number; p95Ms: number;
};

const OTHER_LABELS = ['unknown', 'none'];
const JPEG_FILE = /\.jpe?g$/i;

/** The frames in `<dir>/<label>/<name>.jpg`, sorted by label and name. Throws for a folder that is no label. */
export function listFrames(dir: string, catalog: CatalogIndex): ReplayFrame[] {
  const labels = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const bad = labels.filter((label) => !OTHER_LABELS.includes(label) && !catalog.get(label));
  if (bad.length > 0) {
    throw new Error(`${dir} has a folder that is no label: ${bad.join(', ')}. A label is a product ID, "unknown", or "none".`);
  }
  return labels.flatMap((label) => readdirSync(join(dir, label))
    .filter((name) => JPEG_FILE.test(name))
    .sort()
    .map((name) => ({ label, file: join(dir, label, name) })));
}

/** At most `limit` frames, taken from each label in turn, so a small limit still covers each label. */
export function limitFrames(frames: readonly ReplayFrame[], limit: number): ReplayFrame[] {
  const byLabel = new Map<string, ReplayFrame[]>();
  for (const frame of frames) byLabel.set(frame.label, [...(byLabel.get(frame.label) ?? []), frame]);
  const taken = new Set<ReplayFrame>();
  for (let round = 0; taken.size < Math.min(limit, frames.length); round += 1) {
    for (const group of byLabel.values()) {
      const frame = group[round];
      if (frame && taken.size < limit) taken.add(frame);
    }
  }
  return frames.filter((frame) => taken.has(frame));
}

/**
 * Sends each frame to the recognizer, one at a time, with the time limit of the live path.
 * So the times match those of a shop. `onRow` gets each row when its call ends.
 */
export async function replayFrames(
  frames: readonly ReplayFrame[], recognizer: Recognizer, opts: { timeoutMs: number; onRow?: (row: ReplayRow) => void },
): Promise<ReplayRow[]> {
  const rows: ReplayRow[] = [];
  for (const { label, file } of frames) {
    const jpeg = readFileSync(file);
    const startedAt = performance.now();
    const result = await recognizer
      .recognize(jpeg, { exclude: [], still: false, signal: AbortSignal.timeout(opts.timeoutMs) })
      .catch(() => null);
    const row = { label, file, result, ms: Math.round(performance.now() - startedAt) };
    rows.push(row);
    opts.onRow?.(row);
  }
  return rows;
}

/** The value at the nearest rank of a sorted list, for example 0.95 for p95. */
function nearestRank(sorted: readonly number[], share: number): number {
  return sorted[Math.max(0, Math.ceil(share * sorted.length) - 1)] ?? 0;
}

function median(sorted: readonly number[]): number {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function summarize(rows: readonly ReplayRow[]): ReplayTable {
  const byLabel = new Map<string, ReplayLabelRow>();
  for (const { label, result } of rows) {
    let row = byLabel.get(label);
    if (!row) {
      row = { label, frames: 0, correct: 0, wrong: 0, ambiguous: 0, unsure: 0, unknown: 0, none: 0, failed: 0 };
      byLabel.set(label, row);
    }
    row.frames += 1;
    if (result === null) row.failed += 1;
    // For the labels 'unknown' and 'none', the status with that name is the correct answer.
    else if (OTHER_LABELS.includes(label) ? result.status === label : result.status === 'identified' && result.productId === label) row.correct += 1;
    else if (result.status === 'identified') row.wrong += 1;
    else row[result.status] += 1;
  }

  const labelRows = [...byLabel.values()].sort((a, b) => {
    const rank = (label: string): number => OTHER_LABELS.indexOf(label);
    return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label);
  });
  const sum = (key: 'correct' | 'wrong'): number => labelRows.reduce((total, row) => total + row[key], 0);
  const times = rows.map((row) => row.ms).sort((a, b) => a - b);
  const correct = sum('correct');
  return {
    rows: labelRows,
    frames: rows.length,
    correct,
    wrongIdentified: sum('wrong'),
    accuracy: rows.length === 0 ? 0 : correct / rows.length,
    medianMs: median(times),
    p95Ms: nearestRank(times, 0.95),
  };
}

const COLUMNS = ['frames', 'correct', 'wrong', 'ambiguous', 'unsure', 'unknown', 'none', 'failed'] as const;

/** One row for each label, then the accuracy, the wrong identified count, and the latency. */
export function formatTable(table: ReplayTable): string {
  const labelWidth = Math.max('label'.length, ...table.rows.map((row) => row.label.length));
  const line = (label: string, cells: readonly (string | number)[]): string =>
    [label.padEnd(labelWidth), ...cells.map((cell, index) => String(cell).padStart(COLUMNS[index]!.length))].join('  ');
  return [
    line('label', COLUMNS),
    ...table.rows.map((row) => line(row.label, COLUMNS.map((column) => row[column]))),
    `accuracy: ${(table.accuracy * 100).toFixed(1)}% (${table.correct} of ${table.frames})`,
    `wrong identified: ${table.wrongIdentified}`,
    `latency: median ${table.medianMs} ms, p95 ${table.p95Ms} ms`,
  ].join('\n');
}
