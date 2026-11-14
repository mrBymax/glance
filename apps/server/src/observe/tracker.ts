import { wordMatch, wordsOf } from '../search/normalize';
import type { Legible, Observation } from './observation';

/** What the frames of one appearance agree on. A text field is null until 2 frames agree, or one clear frame has it. */
export type Merged = {
  kind: string | null;
  colors: string[];
  brand: string | null;
  name: string | null;
  variant: string | null;
  size: string | null;
  /** The other words that 2 frames have, or one clear frame, with no case and no accent. */
  texts: string[];
  /** Each digit run that a frame had. A check digit and the store list test them later. */
  digits: string[];
};

/** One frame that the tracker holds for the verify call. */
export type KeptFrame = { jpeg: Uint8Array; at: number; legible: Legible; area: number };

/**
 * One held product, from the first frame that shows it in a hand to the view time with no such frame.
 * `outcome` belongs to the caller: what it decided for this appearance. A new appearance has none.
 */
export type Appearance<Outcome> = {
  id: number;
  /** The time of the oldest and of the newest frame with the product. */
  startedAt: number;
  lastAt: number;
  /** The number of frames with the product. */
  frames: number;
  /** The number of those frames with readable print: `legible` some or clear. */
  legibleFrames: number;
  merged: Merged;
  /** The frames for the verify call, oldest first: the most readable ones, then those with the largest product. */
  kept: KeptFrame[];
  outcome?: Outcome;
};

const RANK: Record<Legible, number> = { none: 0, some: 1, clear: 2 };
/** One clear frame is enough for a field, so it votes two times. */
const CLEAR_VOTES = 2;
const NEEDED_VOTES = 2;
const TEXT_FIELDS = ['brand', 'name', 'variant', 'size'] as const;
type TextField = typeof TEXT_FIELDS[number];

type Votes = Map<string, { votes: number; text: string }>;
type Held = { observation: Observation; at: number; jpeg: Uint8Array };
type State<Outcome> = {
  appearance: Appearance<Outcome>;
  fields: Record<TextField, Votes>;
  kinds: Votes; colors: Votes; texts: Votes;
  digits: Set<string>;
};

const keyOf = (text: string): string => wordsOf(text).join(' ');

function vote(votes: Votes, text: string, weight: number): void {
  const key = keyOf(text);
  if (key === '') return;
  const entry = votes.get(key);
  if (entry) entry.votes += weight;
  else votes.set(key, { votes: weight, text });
}

/** The value with the most votes, when it has the needed votes and no other value has as many. */
function winner(votes: Votes, needed: number): string | null {
  const sorted = [...votes.values()].sort((a, b) => b.votes - a.votes);
  const [first, second] = sorted;
  if (!first || first.votes < needed || (second !== undefined && second.votes === first.votes)) return null;
  return first.text;
}

/** True when each word of one brand has a word in the other: "Baril" is "Barilla", and "Hell" is not "Kili". */
function sameText(a: string, b: string): boolean {
  const [short, long] = wordsOf(a).length <= wordsOf(b).length ? [wordsOf(a), wordsOf(b)] : [wordsOf(b), wordsOf(a)];
  return short.length > 0 && short.every((word) => long.some((other) => wordMatch(word, other) > 0));
}

/**
 * Groups the observations of the frames of one session into appearances of one held product, and merges them.
 * It reads no clock: each observation carries the arrival time of its frame, and the calls can end in another order
 * than the frames. A gap of more than the view time with no held product ends an appearance. So does another brand or
 * another kind of package in 2 held frames in a row: one stray frame changes nothing.
 * The tracker holds the JPEG of at most `keep` frames, plus one frame while a change waits for its second frame.
 */
export class AppearanceTracker<Outcome = unknown> {
  private state: State<Outcome> | null = null;
  /** A held frame with another brand or kind than the appearance. The next held frame decides. */
  private change: Held | null = null;
  private count = 0;

  constructor(private readonly opts: { viewMs: number; keep: number }) {}

  /** The appearance at this time, or null when no product was in a hand inside the view time. */
  current(at: number): Appearance<Outcome> | null {
    return this.state !== null && at - this.state.appearance.lastAt <= this.opts.viewMs ? this.state.appearance : null;
  }

  /**
   * Takes the observation of one frame. Returns the appearance that it belongs to, or null for a frame with no
   * product in a hand, and for an observation that is too old for the appearance.
   */
  add(observation: Observation, at: number, jpeg: Uint8Array): Appearance<Outcome> | null {
    if (!observation.held) return null;
    const held: Held = { observation, at, jpeg };
    const state = this.state;
    if (state === null || at - state.appearance.lastAt > this.opts.viewMs) return this.start([held]);
    if (state.appearance.startedAt - at > this.opts.viewMs) return null;

    if (this.differs(state, observation)) {
      const before = this.change;
      this.change = null;
      if (before === null || !this.agree(before.observation, observation)) {
        this.change = held;
        // The frame counts for the view time, so the appearance does not end while the change waits.
        state.appearance.lastAt = Math.max(state.appearance.lastAt, at);
        return state.appearance;
      }
      return this.start([before, held]);
    }
    this.change = null;
    this.merge(state, held);
    return state.appearance;
  }

  private differs(state: State<Outcome>, observation: Observation): boolean {
    const { brand, kind } = state.appearance.merged;
    if (brand !== null && observation.brand !== null && !sameText(brand, observation.brand)) return true;
    return kind !== null && observation.kind !== null && state.appearance.frames >= NEEDED_VOTES && keyOf(kind) !== keyOf(observation.kind);
  }

  /** Two frames that differ from the appearance show one new product when their brands or their kinds agree. */
  private agree(a: Observation, b: Observation): boolean {
    if (a.brand !== null && b.brand !== null) return sameText(a.brand, b.brand);
    return a.kind !== null && b.kind !== null && keyOf(a.kind) === keyOf(b.kind);
  }

  private start(first: Held[]): Appearance<Outcome> {
    this.count += 1;
    const empty = (): Votes => new Map();
    const state: State<Outcome> = {
      appearance: {
        id: this.count, startedAt: first[0]!.at, lastAt: first[0]!.at, frames: 0, legibleFrames: 0, kept: [],
        merged: { kind: null, colors: [], brand: null, name: null, variant: null, size: null, texts: [], digits: [] },
      },
      fields: { brand: empty(), name: empty(), variant: empty(), size: empty() },
      kinds: empty(), colors: empty(), texts: empty(), digits: new Set(),
    };
    this.state = state;
    this.change = null;
    for (const held of first) this.merge(state, held);
    return state.appearance;
  }

  private merge(state: State<Outcome>, { observation, at, jpeg }: Held): void {
    const { appearance } = state;
    const weight = observation.legible === 'clear' ? CLEAR_VOTES : 1;
    appearance.startedAt = Math.min(appearance.startedAt, at);
    appearance.lastAt = Math.max(appearance.lastAt, at);
    appearance.frames += 1;
    if (observation.legible !== 'none') appearance.legibleFrames += 1;

    for (const field of TEXT_FIELDS) {
      const text = observation[field];
      if (text !== null) vote(state.fields[field], text, weight);
      appearance.merged[field] = winner(state.fields[field], NEEDED_VOTES);
    }
    for (const word of new Set(observation.texts.flatMap(wordsOf))) vote(state.texts, word, weight);
    for (const color of new Set(observation.colors.map(keyOf))) vote(state.colors, color, weight);
    if (observation.kind !== null) vote(state.kinds, observation.kind, 1);
    for (const run of observation.digits) state.digits.add(run);

    const agreed = (votes: Votes): string[] => [...votes.values()].filter((entry) => entry.votes >= NEEDED_VOTES).sort((a, b) => b.votes - a.votes).map((entry) => entry.text);
    appearance.merged.texts = agreed(state.texts);
    appearance.merged.colors = agreed(state.colors);
    // Map keeps the order of the first vote, and sort is stable: with equal votes the kind that was seen first stays.
    appearance.merged.kind = [...state.kinds.values()].sort((a, b) => b.votes - a.votes)[0]?.text ?? null;
    appearance.merged.digits = [...state.digits];

    const area = observation.box === null ? 0 : (observation.box[2] - observation.box[0]) * (observation.box[3] - observation.box[1]);
    const frames = [...appearance.kept, { jpeg, at, legible: observation.legible, area }];
    // The best frames stay: by readable print, then by the size of the product, then the newer one.
    const best = [...frames].sort((a, b) => RANK[b.legible] - RANK[a.legible] || b.area - a.area || b.at - a.at).slice(0, this.opts.keep);
    appearance.kept = best.sort((a, b) => a.at - b.at);
  }
}
