import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  type CreateKioskRequest, type CreateKioskResponse, type KioskEvent, type KioskRef, type Receipt, parseKioskCode,
} from '@glance/shared';
import { type EventBus, kioskTopic } from '../bus';
import type { Clock } from '../clock';
import type { KioskRecord, Store } from '../db/store';
import type { SessionRuntime } from '../sessions/runtime';
import type { SessionState } from '../sessions/types';

/** How long the kiosk shows "paid" or "failed". */
export const KIOSK_RESULT_MS = 10000;
export type KioskResult = { state: 'paid'; receipt: Receipt } | { state: 'failed' };

const CODE_LENGTH = 4;
/** No I, O, 0, or 1: a person reads the code from the screen, and these four look alike. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_BYTES = 24;

/**
 * What the kiosk page shows. A result wins. Else an open checkout of the session at this kiosk shows its cart.
 * The view of a spot check does not name the product: the voice names it, and KioskEvent has no field for it.
 * `session` is the state of the session that holds the kiosk, or null.
 */
export function kioskView(kiosk: KioskRecord, session: SessionState | null, result: KioskResult | null): KioskEvent {
  const base = {
    type: 'kiosk.state' as const,
    kiosk: { id: kiosk._id, name: kiosk.name, store: kiosk.store },
    code: kiosk.code,
  };
  if (result?.state === 'paid') {
    return { ...base, state: 'paid', cart: null, totalCents: result.receipt.totalCents, receipt: result.receipt };
  }
  if (result) return { ...base, state: 'failed', cart: null, totalCents: null, receipt: null };
  if (session?.checkout?.kiosk.id === kiosk._id) {
    const state = session.checkout.step === 'spotcheck' ? 'spotcheck' : 'connected';
    return { ...base, state, cart: session.cart, totalCents: session.cart.totalCents, receipt: null };
  }
  return { ...base, state: 'idle', cart: null, totalCents: null, receipt: null };
}

/**
 * The kiosks of this process. One session holds a kiosk for the time of its checkout (spec section 11.4).
 * The store keeps each kiosk and the ID of its session. The runtime of that session lives only in this process.
 */
export class KioskService {
  /** In the order of the registration, so the last entry is the newest kiosk. */
  private readonly kiosks = new Map<string, KioskRecord>();
  /** Kiosk ID to the session that holds the kiosk. */
  private readonly holders = new Map<string, SessionRuntime>();
  private readonly results = new Map<string, { result: KioskResult; timer: NodeJS.Timeout }>();
  /** Kiosk ID to the last published view as JSON. */
  private readonly published = new Map<string, string>();
  /** One store write at a time, so an old record cannot replace a newer one. */
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly deps: { store: Store; bus: EventBus; clock: Clock }) {}

  /** Reads the kiosks of the store at start. */
  async load(): Promise<void> {
    for (const record of await this.deps.store.listKiosks()) {
      // The session that held the kiosk lived in the old process. Its checkout must start again at the code.
      this.kiosks.set(record._id, { ...record, boundSessionId: null });
    }
  }

  /** `fixedCode` is for the kiosk of the fake server alone. Each other kiosk gets a random code. */
  async register(request: CreateKioskRequest, fixedCode?: string): Promise<CreateKioskResponse> {
    const record: KioskRecord = {
      _id: randomUUID(),
      token: randomBytes(TOKEN_BYTES).toString('base64url'),
      code: fixedCode ?? this.freeCode(),
      name: request.name,
      store: request.store,
      boundSessionId: null,
      lastSeenAt: null,
      spotCheck: request.spotCheck ?? false,
      failPayment: request.failPayment ?? false,
    };
    await this.deps.store.putKiosk(record);
    this.kiosks.set(record._id, record);
    return { kioskId: record._id, token: record.token, code: record.code };
  }

  get(id: string): KioskRecord | null {
    return this.kiosks.get(id) ?? null;
  }

  byCode(code: string): KioskRecord | null {
    for (const record of this.kiosks.values()) {
      if (record.code === code) return record;
    }
    return null;
  }

  /** The kiosk that registered last. */
  newest(): KioskRecord | null {
    return [...this.kiosks.values()].at(-1) ?? null;
  }

  /** For `kiosk.seen` of the phone: `text` is what the QR decoder read. A text that is no code of a kiosk does nothing (R14). */
  sight(session: SessionRuntime, text: string): void {
    const code = parseKioskCode(text);
    const record = code === null ? null : this.byCode(code);
    if (!record) return;
    record.lastSeenAt = this.deps.clock.now();
    const holder = this.holders.get(record._id);
    session.dispatch({
      type: 'kiosk.seen',
      kiosk: refOf(record),
      spotCheck: record.spotCheck,
      busy: holder !== undefined && holder !== session,
    });
  }

  /** This is RuntimeDeps.afterStep. It follows the checkout of the session: bind, release, result, and a new view. */
  sync(session: SessionRuntime, before: SessionState): void {
    const was = before.checkout;
    const now = session.state.checkout;

    if (was && was.kiosk.id !== now?.kiosk.id && this.holders.get(was.kiosk.id) === session) {
      this.holders.delete(was.kiosk.id);
      this.setBound(was.kiosk.id, null);
      if (was.step === 'paying') {
        const receipt = session.state.phase === 'paid' ? session.state.lastReceipt : null;
        this.showResult(was.kiosk.id, receipt ? { state: 'paid', receipt } : { state: 'failed' });
      }
    }
    if (now && !this.holders.has(now.kiosk.id) && this.kiosks.has(now.kiosk.id)) {
      this.holders.set(now.kiosk.id, session);
      this.setBound(now.kiosk.id, session.id);
      this.clearResult(now.kiosk.id);
    }

    if (was) this.publish(was.kiosk.id);
    if (now && now.kiosk.id !== was?.kiosk.id) this.publish(now.kiosk.id);
  }

  /** For a session that a client deletes: its kiosk is free at once. */
  release(sessionId: string): void {
    for (const [kioskId, holder] of this.holders) {
      if (holder.id !== sessionId) continue;
      this.holders.delete(kioskId);
      this.setBound(kioskId, null);
      this.publish(kioskId);
    }
  }

  /** Throws for an unknown kiosk ID. */
  view(id: string): KioskEvent {
    const record = this.kiosks.get(id);
    if (!record) throw new Error(`No kiosk has the ID ${id}.`);
    return kioskView(record, this.holders.get(id)?.state ?? null, this.results.get(id)?.result ?? null);
  }

  /** Ends the result timers, for the close of the app. */
  stop(): void {
    for (const { timer } of this.results.values()) clearTimeout(timer);
    this.results.clear();
  }

  /** Resolves when each store write is done. */
  async settled(): Promise<void> {
    let writes: Promise<void>;
    do {
      writes = this.writes;
      await writes;
    } while (writes !== this.writes);
  }

  private freeCode(): string {
    for (;;) {
      let code = '';
      for (let index = 0; index < CODE_LENGTH; index += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.byCode(code)) return code;
    }
  }

  private setBound(kioskId: string, sessionId: string | null): void {
    const record = this.kiosks.get(kioskId);
    if (!record || record.boundSessionId === sessionId) return;
    record.boundSessionId = sessionId;
    const copy = { ...record };
    this.writes = this.writes.then(() => this.deps.store.putKiosk(copy)).catch((error) => {
      console.error(`kiosk ${kioskId}: the store write failed:`, error);
    });
  }

  private showResult(kioskId: string, result: KioskResult): void {
    this.clearResult(kioskId);
    const timer = setTimeout(() => {
      this.results.delete(kioskId);
      this.publish(kioskId);
    }, KIOSK_RESULT_MS);
    this.results.set(kioskId, { result, timer });
  }

  private clearResult(kioskId: string): void {
    const entry = this.results.get(kioskId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.results.delete(kioskId);
  }

  /** Publishes the view of the kiosk when it differs from the last published view. */
  private publish(kioskId: string): void {
    if (!this.kiosks.has(kioskId)) return;
    const view = this.view(kioskId);
    const json = JSON.stringify(view);
    if (this.published.get(kioskId) === json) return;
    this.published.set(kioskId, json);
    this.deps.bus.publish(kioskTopic(kioskId), view);
  }
}

function refOf(record: KioskRecord): KioskRef {
  return { id: record._id, name: record.name, store: record.store };
}
