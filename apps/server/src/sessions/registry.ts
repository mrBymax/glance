import { randomBytes, randomUUID } from 'node:crypto';
import { type ProfilePatch, ProfileSchema } from '@glance/shared';
import type { SessionRecord } from '../db/store';
import { closeCheckout } from './checkout';
import { type RuntimeDeps, SessionRuntime } from './runtime';
import { createSessionState } from './step';

const TICK_EVERY_MS = 1000;
const TOKEN_BYTES = 24;

/** The sessions of this process. A session that the memory does not hold comes back from the store. */
export class SessionRegistry {
  private readonly sessions = new Map<string, SessionRuntime>();
  /** Two callers that ask for one stored session together must get one runtime. */
  private readonly loading = new Map<string, Promise<SessionRuntime | null>>();
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: RuntimeDeps) {}

  /** Throws a ZodError for a patch with a bad value. */
  async create(patch?: ProfilePatch): Promise<SessionRuntime> {
    const now = this.deps.clock.now();
    const record: SessionRecord = {
      ...createSessionState(ProfileSchema.parse(patch ?? {}), now),
      _id: randomUUID(),
      token: randomBytes(TOKEN_BYTES).toString('base64url'),
      kioskId: null,
      updatedAt: now,
    };
    const session = new SessionRuntime(this.deps, record);
    this.sessions.set(session.id, session);
    // A phone that connects again after a restart finds a session that had no event yet.
    await this.deps.store.putSession(record);
    return session;
  }

  /** Memory first, then the store. */
  async get(id: string): Promise<SessionRuntime | null> {
    const session = this.sessions.get(id);
    if (session) return session;

    let load = this.loading.get(id);
    if (!load) {
      load = this.load(id).finally(() => this.loading.delete(id));
      this.loading.set(id, load);
    }
    return load;
  }

  /** Stops the runtime and deletes the stored session with its orders. */
  async remove(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      this.sessions.delete(id);
      session.stop();
      // A write that started before the stop must not bring the record back after the delete.
      await session.settled();
    }
    await this.deps.store.deleteSession(id);
  }

  /** The sessions that have not stopped, oldest first. */
  live(): SessionRuntime[] {
    return [...this.sessions.values()].filter((session) => !session.stopped);
  }

  /** One timer for all sessions. The rules that depend on time alone need an input each second. */
  startTicks(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      for (const session of this.live()) {
        const { phase } = session.state;
        if (phase === 'shopping' || phase === 'checkout') session.dispatch({ type: 'tick' });
      }
    }, TICK_EVERY_MS);
  }

  /** Stops the tick timer. */
  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private async load(id: string): Promise<SessionRuntime | null> {
    const record = await this.deps.store.getSession(id);
    if (!record) return null;
    // No session holds a kiosk after a restart, so another shopper can have this kiosk now.
    // The shopper keeps the cart and starts the checkout again at the code.
    if (record.checkout && record.checkout.step !== 'paying') closeCheckout(record);
    await this.deps.restoreProducts?.([...new Set([
      ...record.cart.items.map((item) => item.productId), ...record.adds,
      ...(record.prompt?.kind === 'product' ? [record.prompt.productId] : []),
      ...(record.lastAdd ? [record.lastAdd.productId] : []),
    ])]);
    const session = new SessionRuntime(this.deps, record);
    this.sessions.set(id, session);
    // The payment timer of the old process is gone, so this payment can never finish. No order exists for it.
    if (session.state.checkout?.step === 'paying') {
      session.dispatch({ type: 'payment.result', ok: false, orderId: '', paidAt: '' });
    }
    return session;
  }
}
