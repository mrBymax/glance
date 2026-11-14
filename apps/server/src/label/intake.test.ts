import type { FastifyBaseLogger } from 'fastify';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '@glance/shared';
import type { BarcodeReport } from '../products/barcodes';
import type { ReferenceImage, ReferenceImages } from '../reference/images';
import type { StoreList } from '../products/storeList';
import { PRODUCT_KNOWN_MS, STILL_AFTER_ANSWER_MS } from '../sessions/code';
import type { SessionRuntime } from '../sessions/runtime';
import { createSessionState } from '../sessions/step';
import type { RuleInputBody, SessionState } from '../sessions/types';
import { LABEL_EVERY_MS, REFERENCE_CAPTURE_MS, ReferenceCaptureError, createLabelHandler } from './intake';
import { LABEL_TIMEOUT_MS, type LabelAnswer, type LabelReader, NO_LABEL } from './reader';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const header = { seq: 4, ts: 4, w: 1440, h: 1080, blurred: true, kind: 'label' as const };
const nutella = { gtin: '3017624010701', priceCents: 399, name: 'Nutella', brand: 'Ferrero', packSize: '400 g' };
const storeList: StoreList = { byGtin: async () => nutella, all: async () => [nutella] };

let inputs: RuleInputBody[];
let stopListeners: (() => void)[];
let stopped: boolean;
let phase: string;
/** What the rules hold for the session, on top of a new state. */
let held: Partial<SessionState>;
let now: number;
let session: SessionRuntime;
let lines: string[];
let report: ReturnType<typeof vi.fn<BarcodeReport>>;

beforeEach(() => {
  inputs = [];
  stopListeners = [];
  stopped = false;
  phase = 'shopping';
  held = {};
  now = 1_000_000;
  session = {
    id: 's-1',
    get state() { return { ...createSessionState(DEFAULT_PROFILE, 0), ...held, phase }; },
    get stopped() { return stopped; },
    dispatch: (input: RuleInputBody) => { inputs.push(input); },
    onStop: (listener: () => void) => { stopListeners.push(listener); return () => undefined; },
  } as unknown as SessionRuntime;
  lines = [];
  report = vi.fn<BarcodeReport>(async () => 'product');
});
afterEach(() => vi.useRealTimers());

/** A reference store in memory. `pictures` holds the JPEG of each picture, oldest first. */
function memoryReferences(pictures: [string, Uint8Array][] = []): ReferenceImages & { added: [string, Uint8Array][] } {
  const added = [...pictures];
  const imagesOf = (gtin: string): ReferenceImage[] => added
    .flatMap(([code, jpeg], index) => (code === gtin ? [{ gtin, file: `${index}.jpg`, bytes: jpeg.length, addedAt: index }] : []))
    .reverse();
  return {
    added,
    list: async (gtin) => imagesOf(gtin),
    all: async () => new Map([...new Set(added.map(([gtin]) => gtin))].map((gtin) => [gtin, imagesOf(gtin)])),
    add: async (gtin, jpeg) => {
      added.push([gtin, jpeg]);
      return imagesOf(gtin)[0]!;
    },
    read: async (image) => added[image.addedAt]![1],
    remove: async () => 0,
  };
}

function handler(reader: LabelReader | null, over: { references?: ReferenceImages; requireBlur?: boolean } = {}) {
  const write = (line: string): void => { lines.push(line); };
  return createLabelHandler({
    reader, storeList, report, log: { info: write, warn: write } as unknown as FastifyBaseLogger,
    minConfidence: 0.6, minItemConfidence: 0.7, requireBlur: over.requireBlur ?? false, saveFrame: null, clock: { now: () => now },
    references: over.references ?? null,
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
it('logs what the model read, with the item that it chose', async () => {
  handler({ read: async () => ({ ...NO_LABEL, name: 'KARTONKIPIKARI', item: '3017624010701', itemConfidence: 0.9 }) })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(report).toHaveBeenCalledWith(session, '3017624010701', 'label'));
  expect(lines.join('\n')).toContain(
    'label answer seq=4 digits=[] brand=null name="KARTONKIPIKARI" confidence=0 item=3017624010701 itemConfidence=0.9 session=s-1',
  );
});
it('tells the rules that the read failed when the lookup of the match gives no product', async () => {
  report.mockResolvedValue('dropped');
  handler({ read: async () => ({ ...NO_LABEL, digits: ['3017624010701'] }) })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'failed' }]));
});
it('tells the rules that the still was empty when the answer has no digits, no brand, no name, and no item', async () => {
  handler({ read: async () => ({ ...NO_LABEL, packSize: '500 g', confidence: 0.4 }) })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'empty' }]));
  expect(report).not.toHaveBeenCalled();
});
it('an answer that read a text or an item and selects no product is a failed read, not an empty still', async () => {
  for (const part of [{ name: 'Nocciolata' }, { brand: 'Rigoni' }, { digits: ['4006381333931'] }, { item: '4006381333931', itemConfidence: 0.9 }]) {
    inputs = [];
    now += LABEL_EVERY_MS;
    handler({ read: async () => ({ ...NO_LABEL, ...part }) })(session, { header, jpeg: JPEG });
    await vi.waitFor(() => expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'failed' }]));
  }
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
  await vi.waitFor(() => expect(inputs).toContainEqual({ type: 'label', read: 'empty' }));
  now += LABEL_EVERY_MS;
  onFrame(session, { header: { ...header, seq: 6 }, jpeg: JPEG });
  expect(call.signals).toHaveLength(2);
});
it('starts at most one call each 5 seconds for a session, so a phone that sends too many stills costs no call', async () => {
  expect(LABEL_EVERY_MS).toBe(5000);
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const onFrame = handler({ read });
  onFrame(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toContainEqual({ type: 'label', read: 'empty' }));
  inputs = [];
  now += LABEL_EVERY_MS - 1;
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(1);
  expect(inputs).toEqual([]);
  expect(lines.join('\n')).toContain('label frame dropped: the last label call started 4999 ms ago. seq=5');
  // Another session has its own time.
  onFrame({ ...session, id: 's-2', state: session.state, stopped: false } as unknown as SessionRuntime, { header, jpeg: JPEG });
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
it('drops a label frame with no call while the product has its name: an open product prompt, an answer in the last 8 seconds, a name in the last 3 seconds', () => {
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const onFrame = handler({ read });
  const prompt = { id: 'p-0004', kind: 'product' as const, mode: 'new' as const, productId: 'oat-drink-1l', startedAt: now, doneAt: null };
  const code = createSessionState(DEFAULT_PROFILE, 0).code;
  const named: Partial<SessionState>[] = [
    { prompt },
    // The session of 2026-11-14: the still that the server asked for arrived 3.8 seconds after the nod that added the product.
    { code: { ...code, answeredAt: now - 3810 } },
    { code: { ...code, answeredAt: now - STILL_AFTER_ANSWER_MS + 1 } },
    { seen: { 'oat-drink-1l': now - PRODUCT_KNOWN_MS + 1 } },
  ];
  for (held of named) onFrame(session, { header, jpeg: JPEG });
  expect(read).not.toHaveBeenCalled();
  expect(inputs).toEqual([]);
  expect(lines.filter((line) => line === 'label frame dropped: the product is already named. seq=4 session=s-1')).toHaveLength(4);
  // The drop starts no wait of 5 seconds.
  held = { code: { ...code, answeredAt: now - STILL_AFTER_ANSWER_MS }, seen: { 'oat-drink-1l': now - PRODUCT_KNOWN_MS } };
  onFrame(session, { header, jpeg: JPEG });
  expect(read).toHaveBeenCalledTimes(1);
});
it('a marked session still gets its reference picture while a product prompt is open', async () => {
  const references = memoryReferences();
  held = { prompt: { id: 'p-0001', kind: 'product', mode: 'new', productId: 'oat-drink-1l', startedAt: now, doneAt: null } };
  const onFrame = handler(null, { references });
  const capture = onFrame.capture(session, '3017624010701');
  onFrame(session, { header, jpeg: JPEG });
  expect((await capture).count).toBe(1);
});
it('ends a call after 8 seconds, and tells the rules that the call gave no answer', async () => {
  expect(LABEL_TIMEOUT_MS).toBe(8000);
  vi.useFakeTimers();
  const call = pending();
  handler(call.reader)(session, { header, jpeg: JPEG });
  await vi.advanceTimersByTimeAsync(LABEL_TIMEOUT_MS - 1);
  expect(call.signals[0]!.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(call.signals[0]!.aborted).toBe(true);
  expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'error' }]);
  expect(lines.join('\n')).toMatch(/label call failed. seq=4 Error: no answer in 8000 ms/);
});
it('tells the rules that the call gave no answer when the reader fails', async () => {
  handler({ read: async () => { throw new Error('503 overloaded'); } })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(inputs).toEqual([{ type: 'label', read: 'started' }, { type: 'label', read: 'error' }]));
  expect(lines.join('\n')).toContain('label call failed. seq=4 Error: 503 overloaded session=s-1');
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

it('gives the label call the reference pictures of the store items, with the name of each item', async () => {
  const front = new Uint8Array([1, 2, 3]);
  const back = new Uint8Array([4, 5]);
  const references = memoryReferences([['3017624010701', front], ['3017624010701', back], ['4006381333931', front]]);
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  handler({ read }, { references })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  // Newest first. The store list does not hold 4006381333931, so its picture stays out.
  expect(read.mock.calls[0]![1].references).toEqual([
    { gtin: '3017624010701', name: 'Nutella', jpeg: back },
    { gtin: '3017624010701', name: 'Nutella', jpeg: front },
  ]);
  await vi.waitFor(() => expect(lines.join('\n')).toMatch(/label session=s-1 seq=4 match=none ms=\d+ references=2/));
});
it('reads the label with no picture when the reference store fails', async () => {
  const references: ReferenceImages = { ...memoryReferences(), all: async () => { throw new Error('disk gone'); } };
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  handler({ read }, { references })(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  expect(read.mock.calls[0]![1].references).toEqual([]);
  expect(lines.join('\n')).toContain('reference pictures not read. disk gone session=s-1');
});
it('saves the next label frame of a marked session as a reference picture, with no label call and no rule input', async () => {
  const references = memoryReferences();
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const onFrame = handler({ read }, { references });
  const capture = onFrame.capture(session, '3017624010701');
  const message = new Uint8Array(JPEG);
  onFrame(session, { header, jpeg: message });
  message.fill(0);
  expect(await capture).toEqual({ file: '0.jpg', bytes: 4, width: 1440, height: 1080, count: 1 });
  expect(references.added).toEqual([['3017624010701', JPEG]]);
  expect(read).not.toHaveBeenCalled();
  expect(inputs).toEqual([]);
  expect(lines.join('\n')).toContain('reference picture saved. gtin=3017624010701 file=0.jpg bytes=4 seq=4 session=s-1');
  // The mark ends after one frame, and the capture does not count for the limit of 5 seconds.
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  expect(references.added).toHaveLength(1);
});
it('saves a reference picture with no label reader, in each phase, and while a label call runs', async () => {
  const references = memoryReferences();
  phase = 'resting';
  const noReader = handler(null, { references });
  const first = noReader.capture(session, '3017624010701');
  noReader(session, { header, jpeg: JPEG });
  expect((await first).count).toBe(1);

  phase = 'shopping';
  const call = pending();
  const onFrame = handler(call.reader, { references });
  onFrame(session, { header, jpeg: JPEG });
  await vi.waitFor(() => expect(call.signals).toHaveLength(1));
  const second = onFrame.capture(session, '3017624010701');
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  expect((await second).count).toBe(2);
  expect(call.signals).toHaveLength(1);
});
it('ends the mark after 15 seconds, and the next label frame goes to the label call', async () => {
  expect(REFERENCE_CAPTURE_MS).toBe(15_000);
  vi.useFakeTimers();
  const references = memoryReferences();
  const read = vi.fn<LabelReader['read']>(async () => NO_LABEL);
  const onFrame = handler({ read }, { references });
  const outcome = onFrame.capture(session, '3017624010701').catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(REFERENCE_CAPTURE_MS);
  expect(((await outcome) as ReferenceCaptureError).reason).toBe('timeout');
  onFrame(session, { header, jpeg: JPEG });
  await vi.advanceTimersByTimeAsync(0);
  expect(read).toHaveBeenCalledTimes(1);
  expect(references.added).toEqual([]);
});
it('a mark with no label frame fails with a timeout', async () => {
  vi.useFakeTimers();
  const onFrame = handler(null, { references: memoryReferences() });
  const outcome = onFrame.capture(session, '3017624010701').catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(REFERENCE_CAPTURE_MS - 1);
  let done = false;
  void outcome.then(() => { done = true; });
  await vi.advanceTimersByTimeAsync(0);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  const error = await outcome;
  expect(error).toBeInstanceOf(ReferenceCaptureError);
  expect((error as ReferenceCaptureError).reason).toBe('timeout');
});
it('a new mark of a session ends the mark before it', async () => {
  const references = memoryReferences();
  const onFrame = handler(null, { references });
  const first = onFrame.capture(session, '3017624010701').catch((error: unknown) => error);
  const second = onFrame.capture(session, '8076800195057');
  expect(((await first) as ReferenceCaptureError).reason).toBe('replaced');
  onFrame(session, { header, jpeg: JPEG });
  await second;
  expect(references.added).toEqual([['8076800195057', JPEG]]);
});
it('with REQUIRE_BLUR, a frame that is not blurred is no reference picture, and the mark stays', async () => {
  const references = memoryReferences();
  const onFrame = handler(null, { references, requireBlur: true });
  const capture = onFrame.capture(session, '3017624010701');
  onFrame(session, { header: { ...header, blurred: false }, jpeg: JPEG });
  expect(references.added).toEqual([]);
  onFrame(session, { header: { ...header, seq: 5 }, jpeg: JPEG });
  expect((await capture).count).toBe(1);
});
it('a picture that the store cannot write fails the capture', async () => {
  const references: ReferenceImages = { ...memoryReferences(), add: async () => { throw new Error('disk full'); } };
  const onFrame = handler(null, { references });
  const capture = onFrame.capture(session, '3017624010701').catch((error: unknown) => error);
  onFrame(session, { header, jpeg: JPEG });
  expect(((await capture) as ReferenceCaptureError).reason).toBe('failed');
  expect(lines.join('\n')).toContain('reference picture not saved. gtin=3017624010701 disk full session=s-1');
});
it('a session that stops ends its mark', async () => {
  const onFrame = handler(null, { references: memoryReferences() });
  const capture = onFrame.capture(session, '3017624010701').catch((error: unknown) => error);
  for (const listener of stopListeners) listener();
  expect(((await capture) as ReferenceCaptureError).reason).toBe('stopped');
});
