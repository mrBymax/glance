import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import type { Recognizer } from './gemini';
import { type ReplayRow, formatTable, limitFrames, listFrames, replayFrames, summarize } from './replay';
import { NO_RESULT, type RecognitionResult } from './result';

// No test of this file reaches Gemini. Each call goes to a function of the test.

const OAT = 'oat-drink-1l';
const BARISTA = 'oat-drink-barista-1l';
const catalog = indexCatalog(readCatalogFile('catalog/catalog.dev.json'));

const dir = mkdtempSync(join(tmpdir(), 'glance-replay-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function frameFile(label: string, name: string, bytes: number[] = [1]): string {
  mkdirSync(join(dir, label), { recursive: true });
  const path = join(dir, label, name);
  writeFileSync(path, new Uint8Array(bytes));
  return path;
}

const id = (productId: string): RecognitionResult => ({ ...NO_RESULT, status: 'identified', productId, confidence: 0.9 });
const rows: ReplayRow[] = [
  { label: OAT, file: 'a.jpg', result: id(OAT), ms: 1000 },
  { label: OAT, file: 'b.jpg', result: id(BARISTA), ms: 2000 },
  { label: OAT, file: 'c.jpg', result: { ...NO_RESULT, status: 'unsure' }, ms: 3000 },
  { label: 'unknown', file: 'd.jpg', result: { ...NO_RESULT, status: 'unknown' }, ms: 4000 },
  { label: 'none', file: 'e.jpg', result: null, ms: 4000 },
];

it('counts each outcome for each label', () => {
  const table = summarize(rows);
  expect(table.rows.find((r) => r.label === OAT)).toEqual({
    label: OAT, frames: 3, correct: 1, wrong: 1, ambiguous: 0, unsure: 1, unknown: 0, none: 0, failed: 0,
  });
  expect(table.rows.find((r) => r.label === 'none')).toMatchObject({ frames: 1, correct: 0, failed: 1 });
  expect(table).toMatchObject({ frames: 5, correct: 2, wrongIdentified: 1, accuracy: 0.4, medianMs: 3000, p95Ms: 4000 });
});
it('counts an identified result for the labels unknown and none as wrong', () => {
  const table = summarize([
    { label: 'unknown', file: 'a.jpg', result: id(OAT), ms: 1 },
    { label: 'unknown', file: 'b.jpg', result: { ...NO_RESULT, status: 'none' }, ms: 1 },
    { label: 'none', file: 'c.jpg', result: { ...NO_RESULT, status: 'none' }, ms: 1 },
    { label: 'none', file: 'd.jpg', result: { ...NO_RESULT, status: 'unknown' }, ms: 1 },
    { label: OAT, file: 'e.jpg', result: { ...NO_RESULT, status: 'ambiguous', candidates: [OAT, BARISTA] }, ms: 1 },
    { label: OAT, file: 'f.jpg', result: { ...NO_RESULT, status: 'none' }, ms: 1 },
  ]);
  expect(table.rows).toEqual([
    { label: OAT, frames: 2, correct: 0, wrong: 0, ambiguous: 1, unsure: 0, unknown: 0, none: 1, failed: 0 },
    { label: 'unknown', frames: 2, correct: 0, wrong: 1, ambiguous: 0, unsure: 0, unknown: 0, none: 1, failed: 0 },
    { label: 'none', frames: 2, correct: 1, wrong: 0, ambiguous: 0, unsure: 0, unknown: 1, none: 0, failed: 0 },
  ]);
  expect(table).toMatchObject({ frames: 6, correct: 1, wrongIdentified: 1 });
});
it('gives zeros for no rows, and the mean of the two middle times for an even count', () => {
  expect(summarize([])).toEqual({ rows: [], frames: 0, correct: 0, wrongIdentified: 0, accuracy: 0, medianMs: 0, p95Ms: 0 });
  expect(summarize(rows.slice(0, 4))).toMatchObject({ medianMs: 2500, p95Ms: 4000 });
});
it('prints the three summary lines', () => {
  const text = formatTable(summarize(rows));
  expect(text).toContain('accuracy: 40.0% (2 of 5)');
  expect(text).toContain('wrong identified: 1');
  expect(text).toContain('latency: median 3000 ms, p95 4000 ms');
});
it('prints one row for each label below the column names', () => {
  const lines = formatTable(summarize(rows)).split('\n');
  expect(lines[0]).toMatch(/^label +frames +correct +wrong +ambiguous +unsure +unknown +none +failed$/);
  expect(lines[1]).toMatch(/^oat-drink-1l +3 +1 +1 +0 +1 +0 +0 +0$/);
  expect(lines).toHaveLength(7);
});
it('reads the labels from the folder names and rejects an unknown label', () => {
  frameFile('oat-drink-1l', 'a.jpg');
  frameFile('oat-drink-1l', 'B.JPEG');
  frameFile('oat-drink-1l', 'notes.txt');
  frameFile('none', 'b.jpg');
  writeFileSync(join(dir, 'README.txt'), 'a file next to the label folders');
  const frames = listFrames(dir, catalog);
  expect(frames.map((f) => f.label).sort()).toEqual(['none', 'oat-drink-1l', 'oat-drink-1l']);
  expect(frames.map((f) => f.file)).toContain(join(dir, 'oat-drink-1l', 'B.JPEG'));
  frameFile('cola', 'c.jpg');
  expect(() => listFrames(dir, catalog)).toThrow(/cola/);
  rmSync(join(dir, 'cola'), { recursive: true });
});
it('takes frames from each label in turn up to the limit', () => {
  const frames = [
    { label: 'a', file: 'a1' }, { label: 'a', file: 'a2' }, { label: 'a', file: 'a3' },
    { label: 'b', file: 'b1' }, { label: 'c', file: 'c1' }, { label: 'c', file: 'c2' },
  ];
  expect(limitFrames(frames, 4).map((f) => f.file)).toEqual(['a1', 'a2', 'b1', 'c1']);
  expect(limitFrames(frames, 2).map((f) => f.file)).toEqual(['a1', 'b1']);
  expect(limitFrames(frames, 10)).toEqual(frames);
});
it('sends one frame at a time and records a failed call as null', async () => {
  const frames = [
    { label: OAT, file: frameFile(OAT, 'r1.jpg', [1, 2, 3]) },
    { label: OAT, file: frameFile(OAT, 'r2.jpg', [4]) },
    { label: 'none', file: frameFile('none', 'r3.jpg', [5]) },
  ];
  let running = 0;
  let most = 0;
  const recognize = vi.fn<Recognizer['recognize']>(async (jpeg) => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 2));
    running -= 1;
    if (jpeg[0] === 4) throw new Error('503');
    return jpeg[0] === 1 ? id(OAT) : NO_RESULT;
  });
  const seen: string[] = [];
  const out = await replayFrames(frames, { recognize }, { timeoutMs: 1000, onRow: (row) => seen.push(row.file) });

  expect(out.map((row) => row.result?.status ?? null)).toEqual(['identified', null, 'none']);
  expect(out.every((row) => row.ms >= 0)).toBe(true);
  expect(most).toBe(1);
  expect(seen).toEqual(frames.map((f) => f.file));
  expect(new Uint8Array(recognize.mock.calls[0]![0])).toEqual(new Uint8Array([1, 2, 3]));
  expect(recognize.mock.calls[0]![1]).toMatchObject({ exclude: [], still: false });
  expect(recognize.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  expect(summarize(out)).toMatchObject({ frames: 3, correct: 2, wrongIdentified: 0 });
});
