import { expect, it } from 'vitest';
import type { StoreEntry } from '../products/storeEntries';
import { scannedProductId } from '../products/scanned';
import type { Recognizer } from '../recognition/gemini';
import { NO_RESULT } from '../recognition/result';
import { createProductSearch } from '../search/productSearch';
import { NOT_HELD, type Observation } from './observation';
import { createObservePipeline } from './pipeline';
import type { Verifier, VerifyAnswer } from './verify';

const VADELMA = '6430062761764';
const YUZU = '6430062761795';
const MANGO = '6430062761825';
const HELL = '5999571058020';
const entries: StoreEntry[] = [
  { item: { gtin: HELL, priceCents: 149, name: 'Hell Classic Zero Sugarfree', brand: 'Hell', packSize: '250 ml' }, details: null },
  { item: { gtin: VADELMA, priceCents: 249, name: 'Kili Cascara Vadelma', brand: 'Kili', packSize: '330 ml' }, details: null },
  { item: { gtin: YUZU, priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' }, details: null },
  { item: { gtin: MANGO, priceCents: 249, name: 'Kili Cascara Mango + Ananas', brand: 'Kili', packSize: '330 ml' }, details: null },
];
const seen = (part: Partial<Observation> = {}): Observation => ({ ...NOT_HELD, held: true, kind: 'can', legible: 'some', ...part });
const answer = (part: Partial<VerifyAnswer>): VerifyAnswer => ({ gtin: null, confidence: 0.9, seen: 'none', reason: '', calls: 1, lookups: 0, ...part });
const frame = new Uint8Array([0xff, 0xd8]);

/** A pipeline whose observe call gives the observations in turn, and whose verify call gives `verdict`. */
function pipeline(observations: Observation[], verdict: VerifyAnswer | Error | (() => Promise<VerifyAnswer>) = answer({}), store = entries) {
  const verifyInputs: Parameters<Verifier['verify']>[0][] = [];
  const lines: string[] = [];
  let now = 0;
  const made = createObservePipeline({
    observer: { observe: async () => observations.shift() ?? NOT_HELD },
    verifier: {
      verify: async (input) => {
        verifyInputs.push(input);
        if (verdict instanceof Error) throw verdict;
        return typeof verdict === 'function' ? verdict() : verdict;
      },
    },
    search: createProductSearch(store), entries: store, references: null, productIdOf: scannedProductId,
    clock: { now: () => now }, minVerifyConfidence: 0.9, log: (line) => lines.push(line),
  });
  const recognizer: Recognizer = made.forSession('s1');
  const look = (opts: { exclude?: string[]; still?: boolean; ms?: number } = {}) => {
    now += opts.ms ?? 400;
    return recognizer.recognize(frame, { exclude: opts.exclude ?? [], still: opts.still ?? false, signal: new AbortController().signal });
  };
  return { look, verifyInputs, lines };
}

it('a frame with no product in a hand is none', async () => {
  const { look, verifyInputs } = pipeline([NOT_HELD]);
  expect(await look()).toEqual(NO_RESULT);
  expect(verifyInputs).toHaveLength(0);
});
it('names the item with no verify call when 2 frames agree on the brand and the flavor', async () => {
  const { look, verifyInputs, lines } = pipeline([seen({ brand: 'Kili', variant: 'Vadelma' }), seen({ brand: 'KILI', variant: 'vadelma' }), seen()]);
  expect((await look()).status).toBe('none');
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${VADELMA}`, confidence: 1 });
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${VADELMA}` });
  expect(verifyInputs).toHaveLength(0);
  expect(lines).toEqual([`appearance session=s1 n=1 outcome=${VADELMA} by=search frames=2 legible=2 ms=400 matched=["brand: kili","name: vadelma"]`]);
});
it('names the item from one clear frame', async () => {
  const { look } = pipeline([seen({ legible: 'clear', brand: 'Hell', name: 'Classic Zero', size: '250 ml' })]);
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${HELL}` });
});
it('names the item of digits with a right check digit at once, and gives the digits to the code path', async () => {
  const { look } = pipeline([seen({ legible: 'none', digits: [YUZU] })]);
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${YUZU}`, code: { visible: true, digits: YUZU } });
});
it('asks the verify call when 2 frames have print and the search selects no item', async () => {
  const { look, verifyInputs, lines } = pipeline(
    [seen({ brand: 'Kili' }), seen({ brand: 'Kili' }), seen()], answer({ gtin: MANGO, confidence: 0.95, seen: 'text' }),
  );
  expect((await look()).status).toBe('none');
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${MANGO}`, confidence: 0.95 });
  expect(verifyInputs).toHaveLength(1);
  expect(verifyInputs[0]!.frames).toHaveLength(2);
  expect(verifyInputs[0]!.candidates.map((candidate) => candidate.entry.item.gtin).sort()).toEqual([VADELMA, YUZU, MANGO].sort());
  expect(JSON.parse(verifyInputs[0]!.seen)).toMatchObject({ kind: 'can', brand: 'Kili' });
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${MANGO}` });
  expect(verifyInputs).toHaveLength(1);
  expect(lines[0]).toMatch(new RegExp(`^appearance session=s1 n=1 outcome=${MANGO} by=verify frames=2 legible=2 ms=400 verifyMs=0 calls=1 lookups=0 confidence=0.95 seen=text$`));
});
it('gives each item of a small store as a candidate when the frames have no word of an item', async () => {
  const { look, verifyInputs } = pipeline([seen(), seen()], answer({ gtin: HELL, confidence: 1, seen: 'text' }));
  await look();
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${HELL}` });
  expect(verifyInputs[0]!.candidates).toHaveLength(4);
});
it('gives no candidate in a large store when the frames have no word of an item', async () => {
  const more = [...entries, ...['4006381333931', '8076800195057'].map((gtin): StoreEntry => ({ item: { gtin, priceCents: 100, name: `Item ${gtin}` }, details: null }))];
  const { look, verifyInputs } = pipeline([seen(), seen()], answer({}), more);
  await look();
  await look();
  expect(verifyInputs[0]!.candidates).toEqual([]);
});
it('makes no verify call with fewer than 2 frames with print, and reports unsure from the third frame on', async () => {
  const none = (): Observation => seen({ legible: 'none', aimHint: 'turn' });
  const { look, verifyInputs } = pipeline([none(), none(), none(), seen({ legible: 'some' })]);
  expect((await look()).status).toBe('none');
  expect((await look()).status).toBe('none');
  expect(await look()).toMatchObject({ status: 'unsure', aimHint: 'turn', productId: null });
  expect((await look()).status).toBe('unsure');
  expect(verifyInputs).toHaveLength(0);
});
it('takes no item that the verify call chose by its look, and no item below the confidence', async () => {
  for (const verdict of [answer({ gtin: MANGO, confidence: 0.95, seen: 'look' }), answer({ gtin: MANGO, confidence: 0.85, seen: 'text' })]) {
    const { look, lines } = pipeline([seen(), seen({ aimHint: 'closer' }), seen()], verdict);
    await look();
    expect(await look()).toMatchObject({ status: 'unsure', aimHint: 'closer', productId: null });
    expect((await look()).status).toBe('unsure');
    expect(lines[0]).toContain(`outcome=unsure by=verify`);
    expect(lines[0]).toContain(`item=${MANGO}`);
  }
});
it('one appearance gets one verify call', async () => {
  const { look, verifyInputs } = pipeline([seen(), seen(), seen(), seen(), seen()], answer({}));
  for (let i = 0; i < 5; i += 1) await look();
  expect(verifyInputs).toHaveLength(1);
});
it('reports the items of one brand as ambiguous when no word selects one', async () => {
  const { look } = pipeline([seen({ brand: 'Kili', name: 'Cascara' }), seen({ brand: 'Kili', name: 'Cascara' })], answer({}));
  await look();
  const result = await look();
  expect(result.status).toBe('ambiguous');
  expect(result.candidates.sort()).toEqual([VADELMA, YUZU, MANGO].map(scannedProductId).sort());
});
it('reports unknown for a readable product that the store does not have', async () => {
  const cups = (): Observation => seen({ kind: 'pack', brand: 'Pirkka', name: 'Kartonkipikari' });
  const { look } = pipeline([cups(), cups()], answer({ gtin: null, confidence: 0.9 }));
  await look();
  expect(await look()).toMatchObject({ status: 'unknown', productId: null });
});
it('reports unsure, not unknown, when no frame agrees on a text', async () => {
  const { look } = pipeline([seen(), seen()], answer({ gtin: null, confidence: 1 }));
  await look();
  expect((await look()).status).toBe('unsure');
});
it('a later word still names the item after a verify call that named none', async () => {
  const { look, verifyInputs } = pipeline(
    [seen(), seen(), seen({ brand: 'Kili', variant: 'Yuzu' }), seen({ brand: 'Kili', variant: 'Yuzu' })], answer({}),
  );
  await look();
  expect((await look()).status).toBe('unsure');
  expect((await look()).status).toBe('unsure');
  expect(await look()).toMatchObject({ status: 'identified', productId: `gtin-${YUZU}` });
  expect(verifyInputs).toHaveLength(1);
});
it('the item of an appearance does not change', async () => {
  const { look } = pipeline([
    seen({ brand: 'Kili', variant: 'Vadelma' }), seen({ brand: 'Kili', variant: 'Vadelma' }),
    seen({ brand: 'Kili', variant: 'Mango' }), seen({ brand: 'Kili', variant: 'Mango' }), seen({ brand: 'Kili', variant: 'Mango' }),
  ]);
  const results = [];
  for (let i = 0; i < 5; i += 1) results.push((await look()).productId);
  expect(results).toEqual([null, ...Array<string>(4).fill(`gtin-${VADELMA}`)]);
});
it('a new appearance after the view time gets a new decision', async () => {
  const { look } = pipeline([
    seen({ brand: 'Kili', variant: 'Vadelma' }), seen({ brand: 'Kili', variant: 'Vadelma' }),
    seen({ legible: 'clear', brand: 'Kili', variant: 'Mango' }),
  ]);
  await look();
  await look();
  expect(await look({ ms: 3500 })).toMatchObject({ status: 'identified', productId: `gtin-${MANGO}` });
});
it('frames that arrive while the verify call runs wait for it, and get its item', async () => {
  let release: (value: VerifyAnswer) => void = () => undefined;
  const { look, verifyInputs } = pipeline([seen(), seen(), seen(), seen()], () => new Promise((resolve) => {
    release = resolve;
  }));
  await look();
  const second = look();
  const third = look();
  const fourth = look();
  await new Promise((resolve) => setTimeout(resolve, 5));
  release(answer({ gtin: HELL, confidence: 0.95, seen: 'text' }));
  expect((await Promise.all([second, third, fourth])).map((result) => result.productId)).toEqual(Array(3).fill(`gtin-${HELL}`));
  expect(verifyInputs).toHaveLength(1);
});
it('a verify call that fails gives unsure', async () => {
  const { look, lines } = pipeline([seen(), seen()], new Error('boom'));
  await look();
  expect((await look()).status).toBe('unsure');
  expect(lines[0]).toBe('verify call failed. Error: boom');
});
it('a skipped item counts as no product (R9)', async () => {
  const { look } = pipeline([seen({ legible: 'clear', brand: 'Kili', variant: 'Vadelma' }), seen({ brand: 'Kili', name: 'Cascara' }), seen({ brand: 'Kili', name: 'Cascara' })]);
  expect(await look({ exclude: [`gtin-${VADELMA}`] })).toEqual(NO_RESULT);
});
it('a still gets one observe call and one verify call of its own', async () => {
  const { look, verifyInputs } = pipeline([seen({ brand: 'Kili' })], answer({ gtin: YUZU, confidence: 0.95, seen: 'text' }));
  expect(await look({ still: true })).toMatchObject({ status: 'identified', productId: `gtin-${YUZU}` });
  expect(verifyInputs[0]!.frames).toHaveLength(1);
});
it('a clear still names the item of its text with no verify call', async () => {
  const { look, verifyInputs } = pipeline([seen({ legible: 'clear', brand: 'Kili', variant: 'Vadelma' })]);
  expect(await look({ still: true })).toMatchObject({ status: 'identified', productId: `gtin-${VADELMA}` });
  expect(verifyInputs).toHaveLength(0);
});
it('never names an item that the store search does not know', async () => {
  const { look } = pipeline([seen(), seen()], answer({ gtin: '4006381333931', confidence: 1, seen: 'text' }));
  await look();
  expect(await look()).toMatchObject({ status: 'unsure', productId: null });
});
it('asks the verify call a second time after 4 more frames with print, and no third time', async () => {
  const verdicts = [answer({}), answer({ gtin: HELL, confidence: 0.95, seen: 'text' })];
  const { look, verifyInputs } = pipeline(Array.from({ length: 12 }, () => seen()), async () => verdicts.shift() ?? answer({}));
  const statuses: string[] = [];
  for (let i = 0; i < 6; i += 1) statuses.push((await look()).status);
  expect(statuses).toEqual(['none', 'unsure', 'unsure', 'unsure', 'unsure', 'identified']);
  expect(verifyInputs).toHaveLength(2);
  // The second call gets the kept frames of that time.
  expect(verifyInputs[1]!.frames).toHaveLength(3);
});
it('makes at most 2 verify calls for one appearance', async () => {
  const { look, verifyInputs } = pipeline(Array.from({ length: 16 }, () => seen()), answer({}));
  for (let i = 0; i < 16; i += 1) await look();
  expect(verifyInputs).toHaveLength(2);
});
