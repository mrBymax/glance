import { TIMING } from '@glance/shared';
import type { Clock } from '../clock';
import type { StoreEntry } from '../products/storeEntries';
import type { Recognizer } from '../recognition/gemini';
import { NO_RESULT, type RecognitionResult } from '../recognition/result';
import { type ReferenceImage, type ReferenceImages, REFERENCES_FOR_ITEM } from '../reference/images';
import { type Candidate, type ProductSearch, type SearchQuery, pickOne } from '../search/productSearch';
import type { Observer } from './gemini';
import type { Observation } from './observation';
import { type Appearance, AppearanceTracker, type KeptFrame } from './tracker';
import type { Verifier, VerifyAnswer, VerifyCandidate } from './verify';

/** The verify call gets at most this number of candidates, and this number of frames of the appearance. */
export const MAX_VERIFY_CANDIDATES = 5;
export const KEPT_FRAMES = 3;
/**
 * The verify call needs this number of frames in which the observe call read print. Measured on 2026-11-14 on 48
 * verify calls: an answer by text from 2 such frames was right in 8 of 8, and each other answer with an item was
 * wrong in 7 of 18.
 */
export const VERIFY_LEGIBLE_FRAMES = 2;
/**
 * An appearance gets at most this number of verify calls. The first one runs with the first 2 readable frames, which
 * often show the product while it comes into view. The second one runs after VERIFY_AGAIN_LEGIBLE_FRAMES more
 * readable frames, with the best frames of that time.
 */
export const MAX_VERIFY_CALLS = 2;
export const VERIFY_AGAIN_LEGIBLE_FRAMES = 4;
/** After this number of frames with a held product and no name, the frames report `unsure`, and the rules ask for a still. */
export const UNSURE_AFTER_FRAMES = 3;
/**
 * The time of one verify call. The recognition worker drops a frame call after 4 seconds, and the observe call of
 * the frame runs first, so the verify call gets less.
 */
export const VERIFY_TIMEOUT_MS = 2800;
/** A verify answer with no item counts as "the store does not have this product" from this confidence on. */
const NOT_SOLD_MIN_CONFIDENCE = 0.8;

type Decision = { result: Omit<RecognitionResult, 'code'>; by: 'search' | 'verify' };
type State = {
  /** The item of the appearance. It never changes: two items never both win one appearance. */
  named: Decision | null;
  /** What the frames report after a verify call that named no item. */
  unnamed: Decision | null;
  verify: Promise<void> | null;
  /** The number of verify calls of the appearance, and its number of readable frames at the start of the last one. */
  verifyCalls: number;
  legibleAtVerify: number;
};

const plain = { productId: null, candidates: [] as string[], confidence: 0, aimHint: 'none', gesture: 'none' } as const;

const queryOf = (seen: { brand: string | null; name: string | null; variant: string | null; size: string | null; texts: readonly string[]; digits: readonly string[] }): SearchQuery => ({
  brand: seen.brand, name: seen.name, variant: seen.variant, size: seen.size, texts: seen.texts, digits: seen.digits,
});

/**
 * The pipeline "observe, look up, verify" behind the Recognizer interface, so the worker, the frame handler, and the
 * rules stay as they are. `forSession` gives the recognizer of one session: it holds the tracker of that session.
 *
 * Each frame gets one observe call, which knows no store item. The tracker merges the frames of one held product.
 * The search of the store list then names the item with no model call, when the merged text selects one. Else one
 * verify call for the appearance compares the kept frames with the candidates. While it runs, each frame of the
 * appearance waits for it, so the results reach the rules in frame order. A frame with no product in a hand is `none`.
 */
export function createObservePipeline(deps: {
  observer: Observer; verifier: Verifier; search: ProductSearch;
  /** The store list as it was at the start of the server. With at most MAX_VERIFY_CANDIDATES items, each one is a candidate when the search finds none. */
  entries: readonly StoreEntry[];
  /** The reference pictures of the candidates. null: the verify call gets no picture. */
  references: ReferenceImages | null;
  /** The product ID that the rules know for a code of 13 digits. */
  productIdOf: (gtin13: string) => string;
  clock: Clock;
  /** The verify call names an item from this confidence on. */
  minVerifyConfidence: number;
  log: (line: string) => void;
}): { forSession(sessionId: string): Recognizer } {
  const candidatesFor = async (found: readonly Candidate[]): Promise<VerifyCandidate[]> => {
    const gtins = found.length > 0 ? found.map((candidate) => candidate.gtin)
      : deps.entries.length <= MAX_VERIFY_CANDIDATES ? deps.entries.map((entry) => entry.item.gtin) : [];
    const pictures = deps.references === null ? new Map<string, ReferenceImage[]>() : await deps.references.all().catch((error: unknown) => {
      deps.log(`reference pictures not read. ${error instanceof Error ? error.message : String(error)}`);
      return new Map<string, ReferenceImage[]>();
    });
    const candidates = await Promise.all(gtins.slice(0, MAX_VERIFY_CANDIDATES).map(async (gtin): Promise<VerifyCandidate[]> => {
      const entry = await deps.search.get(gtin);
      if (!entry) return [];
      const files = (pictures.get(gtin) ?? []).slice(0, REFERENCES_FOR_ITEM);
      return [{ entry, pictures: await Promise.all(files.map((file) => deps.references!.read(file))) }];
    }));
    return candidates.flat();
  };

  const identified = (gtin: string, confidence: number): Decision['result'] => ({ ...plain, status: 'identified', productId: deps.productIdOf(gtin), confidence });

  /** What the frames report when the verify call named no item. */
  const unnamedAfter = (answer: VerifyAnswer | null, found: readonly Candidate[], readText: boolean, aimHint: Observation['aimHint']): Decision['result'] => {
    // The read brand fits two or more items, and no word selects one: the look-alike answer of the rules.
    const alike = found.filter((candidate) => candidate.matched.brand && candidate.score === found[0]!.score);
    if (alike.length >= 2) return { ...plain, status: 'ambiguous', candidates: alike.map((candidate) => deps.productIdOf(candidate.gtin)), confidence: found[0]!.score };
    // Two frames agree on a brand or a name, no item has these words, and the verify call found no item either.
    if (readText && found.length === 0 && answer !== null && answer.gtin === null && answer.confidence >= NOT_SOLD_MIN_CONFIDENCE) {
      return { ...plain, status: 'unknown', confidence: answer.confidence };
    }
    return { ...plain, status: 'unsure', aimHint };
  };

  const verify = async (frames: readonly Uint8Array[], found: readonly Candidate[], seen: unknown): Promise<VerifyAnswer | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), VERIFY_TIMEOUT_MS);
    try {
      const answer = await deps.verifier.verify({ frames, candidates: await candidatesFor(found), seen: JSON.stringify(seen) }, { signal: abort.signal });
      // The final guard: the item must be one that the search of the store knows.
      if (answer.gtin !== null && await deps.search.get(answer.gtin) === undefined) return { ...answer, gtin: null };
      return answer;
    } catch (error) {
      deps.log(`verify call failed. ${error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : String(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const accepted = (answer: VerifyAnswer | null): answer is VerifyAnswer & { gtin: string } => (
    answer !== null && answer.gtin !== null && answer.seen === 'text' && answer.confidence >= deps.minVerifyConfidence
  );

  return {
    forSession(sessionId) {
      const tracker = new AppearanceTracker<State>({ viewMs: TIMING.viewMs, keep: KEPT_FRAMES });

      const decide = async (appearance: Appearance<State>, state: State, observation: Observation): Promise<void> => {
        if (state.verify !== null) {
          await state.verify;
          return;
        }
        const found = await deps.search.search(queryOf(appearance.merged), MAX_VERIFY_CANDIDATES);
        // The search is a promise, and another frame of the appearance can decide while it runs.
        if (state.named !== null) return;
        if (state.verify !== null) {
          await state.verify;
          return;
        }
        const picked = pickOne(found);
        const since = (): number => deps.clock.now() - appearance.startedAt;
        const line = (outcome: string, by: string, extra = ''): void => deps.log(
          `appearance session=${sessionId} n=${appearance.id} outcome=${outcome} by=${by} frames=${appearance.frames} legible=${appearance.legibleFrames} ms=${since()}${extra}`,
        );
        if (picked) {
          state.named = { result: identified(picked.gtin, picked.score), by: 'search' };
          line(picked.gtin, 'search', ` matched=${JSON.stringify(picked.reasons)}`);
          return;
        }
        const needed = state.verifyCalls === 0 ? VERIFY_LEGIBLE_FRAMES : state.legibleAtVerify + VERIFY_AGAIN_LEGIBLE_FRAMES;
        if (state.verifyCalls >= MAX_VERIFY_CALLS || appearance.legibleFrames < needed) return;
        state.verifyCalls += 1;
        state.legibleAtVerify = appearance.legibleFrames;

        const kept: readonly KeptFrame[] = appearance.kept;
        const startedAt = deps.clock.now();
        state.verify = (async () => {
          const answer = await verify(kept.map((frame) => frame.jpeg), found, { kind: appearance.merged.kind, colors: appearance.merged.colors, ...queryOf(appearance.merged) });
          const extra = ` verifyMs=${deps.clock.now() - startedAt} calls=${answer?.calls ?? 0} lookups=${answer?.lookups ?? 0} confidence=${answer?.confidence ?? 'none'} seen=${answer?.seen ?? 'none'}`;
          if (accepted(answer)) {
            state.named = { result: identified(answer.gtin, answer.confidence), by: 'verify' };
            line(answer.gtin, 'verify', extra);
          } else {
            const readText = appearance.merged.brand !== null || appearance.merged.name !== null;
            state.unnamed = { result: unnamedAfter(answer, found, readText, observation.aimHint), by: 'verify' };
            line(state.unnamed.result.status, 'verify', `${extra} item=${answer?.gtin ?? 'none'}`);
          }
        })().finally(() => {
          state.verify = null;
        });
        await state.verify;
      };

      const still = async (jpeg: Uint8Array, observation: Observation): Promise<Decision['result']> => {
        const found = await deps.search.search(queryOf(observation), MAX_VERIFY_CANDIDATES);
        const picked = observation.legible === 'clear' ? pickOne(found) : null;
        if (picked) return identified(picked.gtin, picked.score);
        const answer = await verify([jpeg], found, { kind: observation.kind, colors: observation.colors, ...queryOf(observation) });
        if (accepted(answer)) return identified(answer.gtin, answer.confidence);
        return unnamedAfter(answer, found, observation.legible === 'clear' && (observation.brand !== null || observation.name !== null), observation.aimHint);
      };

      return {
        async recognize(jpeg, opts) {
          const at = deps.clock.now();
          const observation = await deps.observer.observe(jpeg, { signal: opts.signal });
          if (!observation.held) {
            tracker.add(observation, at, jpeg);
            return NO_RESULT;
          }
          const code = { visible: observation.digits.length > 0, digits: observation.digits[0] ?? null };
          let result: Decision['result'];
          if (opts.still) {
            result = await still(jpeg, observation);
          } else {
            const appearance = tracker.add(observation, at, jpeg);
            if (appearance === null) return NO_RESULT;
            const state = appearance.outcome ??= { named: null, unnamed: null, verify: null, verifyCalls: 0, legibleAtVerify: 0 };
            if (state.named === null) await decide(appearance, state, observation);
            // A held product with no name yet is no result for the rules: an `unsure` result asks the phone for a still,
            // which stops the motion stream. The frames report `unsure` only when they cannot name the product.
            result = state.named?.result ?? state.unnamed?.result
              ?? (appearance.frames >= UNSURE_AFTER_FRAMES && appearance.legibleFrames < VERIFY_LEGIBLE_FRAMES
                ? { ...plain, status: 'unsure', aimHint: observation.aimHint } : { ...plain, status: 'none' });
          }
          // R9: the shopper just skipped this product, so the frame counts as a frame with no product.
          if (result.productId !== null && opts.exclude.includes(result.productId)) return { ...NO_RESULT, code };
          return { ...result, candidates: result.candidates.filter((id) => !opts.exclude.includes(id)), code };
        },
      };
    },
  };
}
