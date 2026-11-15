// A test helper. No product code imports this file.
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PROFILE, type DeviceState, type IntentKind, type IntentSource, type KioskRef, type Product, type ProfilePatch,
  type ServerEvent, cartTotalCents, localize,
} from '@glance/shared';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { NO_RESULT, type RecognitionResult } from '../recognition/result';
import { createSessionState, step } from './step';
import type { BarcodeOutcome, Effect, RuleContext, RuleInputBody, SessionState, SpeakEffect, Verdict } from './types';

export const OAT = 'oat-drink-1l', BARISTA = 'oat-drink-barista-1l', RYE = 'rye-bread', CRISPS = 'potato-crisps';
export const KIOSK: KioskRef = { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' };
export const STREAMING: DeviceState = { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream: 'streaming' };

const START = 1_000_000;
const HOLD_STEP_MS = 500;
const DEV_CATALOG = fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url));

/** A valid product, for a test that needs more than the dev catalog. */
export function product(id: string, priceCents: number): Product {
  return {
    id,
    name: { en: `Test ${id}` },
    spokenName: { en: `Test ${id}` },
    brand: 'Demo Brand',
    packSize: '1 pc',
    spokenPack: { en: 'one piece' },
    spokenPackDetailed: { en: 'one piece pack' },
    priceCents,
    allergens: [],
    vegan: null,
    vegetarian: null,
    visual: 'A plain white box with a black label.',
    lookAlikes: [],
  };
}

export type Harness = {
  /** A test can replace it. */
  state: SessionState;
  ctx: RuleContext;
  /** Starts at 1_000_000. */
  now: number;
  /** Of the last input. */
  effects: Effect[];
  /** Since the start. */
  all: Effect[];
  /** Of the last input: null for an input that is no intent. */
  verdict: Verdict | null;
  /** Adds `now`, runs `step`, keeps the state and the effects. */
  send(input: RuleInputBody): void;
  /** Moves the clock, then sends one tick. */
  advance(ms: number): void;
  /** Moves the clock to start + ms, then sends one tick. */
  at(ms: number): void;
  /** One identified result of a stream frame. With no prompt for the product, it opens none. */
  see(productId: string): void;
  /** 2 identified results in a row at one time: sight opens the prompt of the product with the second one. */
  show(productId: string): void;
  /** See now, then advance 500 and see, until ms have passed. */
  hold(productId: string, ms: number): void;
  /** NO_RESULT with the given fields. */
  result(part: Partial<RecognitionResult>): void;
  /** Frames with no product: advance 500 and send an empty result, until ms have passed. */
  away(ms: number): void;
  /** kiosk.seen for KIOSK. */
  kiosk(opts?: { busy?: boolean; spotCheck?: boolean }): void;
  /** A barcode after its lookup. */
  barcode(outcome: BarcodeOutcome): void;
  /** A label frame that arrived, that gave no product, that showed no product, or whose call gave no answer. */
  label(read: 'started' | 'failed' | 'empty' | 'error'): void;
  /** prompt.done for the current prompt. */
  done(): void;
  /** Defaults: 'head', and the prompt of the last done(). */
  yes(source?: IntentSource, promptId?: string): void;
  no(source?: IntentSource, promptId?: string): void;
  /** Default source: 'voice'. */
  intent(kind: IntentKind, source?: IntentSource): void;
  /** Line keys of the last input. */
  lines(): string[];
  /** Event types of the last input. */
  events(): string[];
  /** The first speak effect of the last input. */
  speak(): SpeakEffect | undefined;
  /** Of the last input. */
  event<K extends ServerEvent['type']>(type: K): Extract<ServerEvent, { type: K }> | undefined;
};

export function harness(
  opts: { profile?: ProfilePatch; products?: Product[]; cart?: string[]; secondLookWaitMs?: number; biometricAboveCents?: number } = {},
): Harness {
  const catalog = indexCatalog([...readCatalogFile(DEV_CATALOG), ...(opts.products ?? [])]);
  const profile = { ...DEFAULT_PROFILE, ...opts.profile };
  let state = createSessionState(profile, START);

  if (opts.cart && opts.cart.length > 0) {
    const items = opts.cart.map((id) => {
      const entry = catalog.get(id);
      if (!entry) throw new Error(`harness: the catalog has no product "${id}".`);
      return {
        productId: id, name: localize(entry.name, profile.lang), packSize: entry.packSize, qty: 1, unitPriceCents: entry.priceCents,
      };
    });
    state = { ...state, cart: { items, totalCents: cartTotalCents(items) } };
  }

  let lastDoneId: string | undefined;
  const h: Harness = {
    state,
    ctx: { catalog, secondLookWaitMs: opts.secondLookWaitMs ?? 0, biometricAboveCents: opts.biometricAboveCents ?? null },
    now: START,
    effects: [],
    all: [],
    verdict: null,
    send(input) {
      const next = step(h.state, { ...input, now: h.now }, h.ctx);
      h.state = next.state;
      h.effects = next.effects;
      h.verdict = next.verdict;
      h.all.push(...next.effects);
    },
    advance(ms) {
      h.now += ms;
      h.send({ type: 'tick' });
    },
    at(ms) {
      h.now = START + ms;
      h.send({ type: 'tick' });
    },
    see(productId) {
      h.result({ status: 'identified', productId, confidence: 1 });
    },
    show(productId) {
      h.see(productId);
      h.see(productId);
    },
    hold(productId, ms) {
      h.see(productId);
      for (let elapsed = HOLD_STEP_MS; elapsed <= ms; elapsed += HOLD_STEP_MS) {
        h.advance(HOLD_STEP_MS);
        h.see(productId);
      }
    },
    result(part) {
      h.send({ type: 'recognition', result: { ...NO_RESULT, ...part }, still: false });
    },
    away(ms) {
      for (let elapsed = HOLD_STEP_MS; elapsed <= ms; elapsed += HOLD_STEP_MS) {
        h.advance(HOLD_STEP_MS);
        h.result({});
      }
    },
    kiosk(kioskOpts = {}) {
      h.send({ type: 'kiosk.seen', kiosk: KIOSK, busy: kioskOpts.busy ?? false, spotCheck: kioskOpts.spotCheck ?? false });
    },
    barcode(outcome) {
      h.send({ type: 'barcode', outcome });
    },
    label(read) {
      h.send({ type: 'label', read });
    },
    done() {
      if (!h.state.prompt) throw new Error('harness: done() needs a current prompt.');
      lastDoneId = h.state.prompt.id;
      h.send({ type: 'prompt.done', promptId: lastDoneId });
    },
    yes(source = 'head', promptId = lastDoneId) {
      h.send({ type: 'intent', kind: 'yes', source, ...(promptId === undefined ? {} : { promptId }) });
    },
    no(source = 'head', promptId = lastDoneId) {
      h.send({ type: 'intent', kind: 'no', source, ...(promptId === undefined ? {} : { promptId }) });
    },
    intent(kind, source = 'voice') {
      h.send({ type: 'intent', kind, source });
    },
    lines() {
      return h.effects.filter((effect): effect is SpeakEffect => effect.type === 'speak').map((effect) => effect.line.key);
    },
    events() {
      return h.effects.flatMap((effect) => (effect.type === 'event' ? [effect.event.type] : []));
    },
    speak() {
      return h.effects.find((effect): effect is SpeakEffect => effect.type === 'speak');
    },
    event<K extends ServerEvent['type']>(type: K) {
      for (const effect of h.effects) {
        if (effect.type === 'event' && effect.event.type === type) return effect.event as Extract<ServerEvent, { type: K }>;
      }
      return undefined;
    },
  };
  return h;
}
