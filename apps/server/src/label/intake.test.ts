import type { FastifyBaseLogger } from 'fastify';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { BarcodeReport } from '../products/barcodes';
import type { StoreList } from '../products/storeList';
import type { SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { LABEL_EVERY_MS, LABEL_TIMEOUT_MS, createLabelHandler } from './intake';
import { type LabelAnswer, type LabelReader, NO_LABEL } from './reader';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const header = { seq: 4, ts: 4, w: 1440, h: 1080, blurred: true, kind: 'label' as const };
const nutella = { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' };
const storeList: StoreList = { byGtin: async () => nutella, all: async () => [nutella] };

let inputs: RuleInputBody[];
let stopListeners: (() => void)[];
let stopped: boolean;
let phase: string;
let now: number;
let session: SessionRuntime;
let lines: string[];
let report: ReturnType<typeof vi.fn<BarcodeReport>>;

beforeEach(() => {
  inputs = [];
  stopListeners = [];
  stopped = false;
  phase = 'shopping';
  now = 1_000_000;
  session = {
    id: 's-1',
    get state() { return { phase }; },
    get stopped() { return stopped; },
    dispatch: (input: RuleInputBody) => { inputs.push(input); },
    onStop: (listener: () => void) => { stopListeners.push(listener); return () => undefined; },
  } as unknown as SessionRuntime;
  lines = [];
  report = vi.fn<BarcodeReport>(async () => 'product');
});
afterEach(() => vi.useRealTimers());

function handler(reader: LabelReader) {
  const write = (line: string): void => { lines.push(line); };
  return createLabelHandler({
    reader, storeList, report, log: { info: write, warn: write } as unknown as FastifyBaseLogger,
    minConfidence: 0.6, requireBlur: false, saveFrame: null, clock: { now: () => now },
  });
}
const pending = (): { reader: LabelReader; answer: (value: LabelAnswer) => void; signals: AbortSignal[] } => {
  const signals: AbortSignal[] = [];
  let answer!: (value: LabelAnswer) => void;
  const reader: LabelReader = { read: (_jpeg, opts) => { signals.push(opts.signal); return new Promise((resolve) => { answer = resolve; }); } };
  return { reader, answer: (value) => answer(value), signals };
};
const settled = () => new Promise((resolve) => setImmediate(resolve));

it('tells the rules that a label frame arrived, and reports the code of a match as a label read', async () => {
  const call = pending();
  handler(call.reader)(session, { header, jpeg: JPEG });
  expect(inputs).toEqual([{ type: 'label', read: 'started' }]);
  call.answer({ ...NO_LABEL, digits: ['3017624010701'] });
  await vi.waitFor(() => expect(report).toHaveBeenCalledWith(session, '3017624010701', 'label'));
  await settled();
  expect(inputs).toEqual([{ type: 'label', read: 'started' }]);
  expect(lines.join('\n')).toMatch(/label session=s-1 seq=4 match=3017624010701 ms=\d+/);
});
it('tells the rules that the read failed when the lookup of the match gives no product', async () => {
  report.mockResolvedValue('dropped');
  handler({ read: async () => ({ ...NO_LABEL, digits: ['3017624010701'] }) })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'failed' }]));
});
it('gives the reader a copy of the JPEG', async () => {
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const message = new Uint8Array(JPEG);
  handler({ read })(session, { header, jpeg: message });
  message.fill(0);
  expect([...read.mock.calls[0]![0]]).toEqual([...JPEG]);
});
it('drops a label frame while a call of the session runs', async () => {
  const call = pending();
  const onFrame = handler(call.reader);
  onFrame(session, { header, jpeg: JPEG });
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  expect(call.signals).toHaveLength(1);
  expect(lines.join('\n')).toContain('label frame dropped: a label call runs. seq=5');
  call.answer(NO_LABEL);
  await vi.waitFor(() => expect(inputs).toContainEqual({ type: 'label', read: 'failed' }));
  now += LABEL_EVERY_MS;
  onFrame(session, { header: { ...header, seq: 6 }, jpeg: JPEG });
  expect(call.signals).toHaveLength(2);
});
it('starts at most one call each 5 seconds for a session, so a phone that sends too many stills costs no call', async () => {
  expect(LABEL_EVERY_MS).toBe(5000);
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const onFrame = handler({ read });
  onFrame(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toContainEqual({ type: 'label', read: 'failed' }));
  inputs = [];
  now += LABEL_EVERY_MS - 1;
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(1);
  expect(inputs).toEqual([]);
  expect(lines.join('\n')).toContain('label frame dropped: the last label call started 4999 ms ago. seq=5');
  // Another session has its own time.
  onFrame({ ...session, id: 's-2', state: { phase: 'shopping' }, stopped: false } as unknown as SessionRuntime, { header, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(2);
  now += 1;
  onFrame(session, { header: { ...header, seq: 6 }, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(3);
});
it('drops a label frame of a session that does not shop, with no call', () => {
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  for (phase of ['resting', 'paid', 'ended']) handler({ read })(session, { header, jpeg: JPEG });
  expect(read).not.toHaveBeenCalled();
  expect(inputs).toEqual([]);
  phase = 'checkout';
  handler({ read })(session, { header, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(1);
});
it('ends a call after 4 seconds, and the read counts as failed', async () => {
  expect(LABEL_TIMEOUT_MS).toBe(4000);
  vi.useFakeTimers();
  const call = pending();
  handler(call.reader)(session, { header, jpeg: JPEG });
  await vi.advanceTimersByTimeAsync(LABEL_TIMEOUT_MS - 1);
  expect(call.signals[0]!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(call.signals[0]!.aborted).toBe(true);
  expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'failed' }]);
  expect(lines.join('\n')).toMatch(/label call failed. seq=4 Error: no answer in 4000 ms/);
});
it('aborts the call when the session stops, and gives the rules nothing more', async () => {
  const call = pending();
  handler(call.reader)(session, { header, jpeg: JPEG });
  stopped = true;
  for (const listener of stopListeners) listener();
  expect(call.signals[0]!.aborted).toBe(true);
  call.answer({ ...NO_LABEL, digits: ['3017624010701'] });
  await settled();
  expect(report).not.toHaveBeenCalled();
  expect(inputs).toEqual([{ type: 'label', read: 'started' }]);
});
it('stopAll aborts each call', () => {
  const call = pending();
  const onFrame = handler(call.reader);
  onFrame(session, { header, jpeg: JPEG });
  onFrame.stopAll();
  expect(call.signals[0]!.aborted).toBe(true);
});
