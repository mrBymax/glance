import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TIMING } from '@glance/shared';
import type { Recognizer } from './gemini';
import { NO_RESULT, type RecognitionResult } from './result';
import { type Frame, RecognitionWorker } from './worker';

type RecognizeOpts = Parameters<Recognizer['recognize']>[1];
type Call = { opts: RecognizeOpts; resolve: (result: RecognitionResult) => void; reject: (error: Error) => void };
type Result = { result: RecognitionResult; info: { seq: number; still: boolean; ms: number } };

const frame = (seq: number, kind?: 'still'): Frame =>
  ({ header: { seq, ts: 0, w: 576, h: 768, blurred: true, kind }, jpeg: new Uint8Array(1000) });
const ok: RecognitionResult = { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.9 };
/** Waits for the pending promises. */
const flush = () => vi.advanceTimersByTimeAsync(0);

let calls: Call[];
let results: Result[];
let logs: string[];
let exclude: string[];
let onSlow: ReturnType<typeof vi.fn<() => void>>;
let worker: RecognitionWorker;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  results = [];
  logs = [];
  exclude = [];
  onSlow = vi.fn<() => void>();
  const recognizer: Recognizer = {
    recognize: (_jpeg, opts) => new Promise((resolve, reject) => { calls.push({ opts, resolve, reject }); }),
  };
  worker = new RecognitionWorker({
    recognizer,
    exclude: () => exclude,
    onResult: (result, info) => { results.push({ result, info }); },
    onSlow,
    log: (line) => { logs.push(line); },
  });
});
afterEach(() => {
  worker.stop();
  vi.useRealTimers();
});

it('runs one call at a time, and the newest frame wins', async () => {
  for (const seq of [1, 2, 3, 4]) worker.submit(frame(seq));
  expect(calls).toHaveLength(1);
  calls[0]!.resolve(ok); await flush();
  calls[1]!.resolve(ok); await flush();
  expect(results.map((r) => r.info.seq)).toEqual([1, 4]);   // frames 2 and 3 never reach the recognizer
  expect(calls).toHaveLength(2);
});
it('gives the result with the frame number, the kind, and the time of the call', async () => {
  worker.submit(frame(7, 'still'));
  await vi.advanceTimersByTimeAsync(250);
  calls[0]!.resolve(ok); await flush();
  expect(results).toEqual([{ result: ok, info: { seq: 7, still: true, ms: 250 } }]);
});
it('drops a call after 4 seconds and goes on with the next frame', async () => {
  worker.submit(frame(1)); worker.submit(frame(2));
  await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs);
  expect(calls[0]!.opts.signal.aborted).toBe(true);
  expect(calls).toHaveLength(2);
  calls[0]!.resolve(ok); await flush();   // the late answer
  expect(results).toEqual([]);
});
it('does not drop a call that answers in time', async () => {
  worker.submit(frame(1));
  await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs - 1);
  calls[0]!.resolve(ok); await flush();
  await vi.advanceTimersByTimeAsync(10);
  expect(calls[0]!.opts.signal.aborted).toBe(false);
  expect(results).toHaveLength(1);
});
it('reports slow after 3 failed calls in a row, one time, and counts again after a good call', async () => {
  for (const seq of [1, 2, 3, 4]) { worker.submit(frame(seq)); calls.at(-1)!.reject(new Error('503')); await flush(); }
  expect(onSlow).toHaveBeenCalledTimes(1);
  worker.submit(frame(5)); calls.at(-1)!.resolve(ok); await flush();
  for (const seq of [6, 7, 8]) { worker.submit(frame(seq)); calls.at(-1)!.reject(new Error('503')); await flush(); }
  expect(onSlow).toHaveBeenCalledTimes(2);
});
it('counts a call that timed out as failed', async () => {
  for (const seq of [1, 2, 3]) {
    worker.submit(frame(seq));
    await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs);
  }
  expect(onSlow).toHaveBeenCalledTimes(1);
});
it('logs the name and at most 200 characters of the message of a failed call', async () => {
  worker.submit(frame(1));
  calls[0]!.reject(new TypeError('x'.repeat(500))); await flush();
  expect(logs).toEqual([`recognition call failed. seq=1 TypeError: ${'x'.repeat(200)}`]);
});
it('reads the exclude list at the start of each call', async () => {
  exclude = ['a']; worker.submit(frame(1));
  exclude = ['b']; worker.submit(frame(2));
  calls[0]!.resolve(ok); await flush();
  expect(calls.map((c) => c.opts.exclude)).toEqual([['a'], ['b']]);
});
it('holds no frame after the call', async () => {
  worker.submit(frame(1)); worker.submit(frame(2));
  expect(worker.heldBytes()).toBe(2000);
  calls[0]!.resolve(ok); await flush();
  calls[1]!.resolve(ok); await flush();
  expect(worker.heldBytes()).toBe(0);
});
it('holds no frame after a failed call and after a dropped call', async () => {
  worker.submit(frame(1));
  calls[0]!.reject(new Error('503')); await flush();
  expect(worker.heldBytes()).toBe(0);
  worker.submit(frame(2));
  await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs);
  expect(worker.heldBytes()).toBe(0);
});
it('a later frame does not replace a waiting still', async () => {
  worker.submit(frame(1)); worker.submit(frame(2, 'still')); worker.submit(frame(3));
  calls[0]!.resolve(ok); await flush();
  expect(calls[1]!.opts.still).toBe(true);
});
it('a later still replaces a waiting still', async () => {
  worker.submit(frame(1)); worker.submit(frame(2, 'still')); worker.submit(frame(3, 'still'));
  calls[0]!.resolve(ok); await flush();
  calls[1]!.resolve(ok); await flush();
  expect(results.map((r) => r.info.seq)).toEqual([1, 3]);
});
it('goes on when the recognizer throws at once', async () => {
  const throwing = new RecognitionWorker({
    recognizer: { recognize: () => { throw new Error('bad request'); } },
    exclude: () => [], onResult: () => undefined, onSlow, log: (line) => { logs.push(line); },
  });
  for (const seq of [1, 2, 3]) { throwing.submit(frame(seq)); await flush(); }
  expect(onSlow).toHaveBeenCalledTimes(1);
  expect(throwing.heldBytes()).toBe(0);
});
it('stop ends the work', async () => {
  worker.submit(frame(1)); worker.submit(frame(2)); worker.stop();
  expect(calls[0]!.opts.signal.aborted).toBe(true);
  calls[0]!.resolve(ok); await flush();
  expect(results).toEqual([]);
  expect(calls).toHaveLength(1);
  expect(worker.heldBytes()).toBe(0);
});
it('takes no frame after stop', async () => {
  worker.stop();
  worker.submit(frame(1));
  await vi.advanceTimersByTimeAsync(TIMING.recognitionTimeoutMs);
  expect(calls).toEqual([]);
  expect(onSlow).not.toHaveBeenCalled();
});
