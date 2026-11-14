import type { Product } from '@glance/shared';
import type { ClipRecord, KioskRecord, OrderRecord, SessionRecord, Store } from './store';

/** Keeps the data in this process. A restart loses it. */
export class MemoryStore implements Store {
  private products: Product[] = [];
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly kiosks = new Map<string, KioskRecord>();
  private readonly orders = new Map<string, OrderRecord>();
  private readonly clips = new Map<string, ClipRecord>();

  constructor(products: Product[] = []) {
    this.setProducts(products);
  }

  async listProducts(): Promise<Product[]> {
    return structuredClone(this.products);
  }

  async replaceProducts(products: Product[]): Promise<void> {
    this.setProducts(products);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return structuredClone(this.sessions.get(id) ?? null);
  }

  async putSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record._id, structuredClone(record));
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    for (const order of [...this.orders.values()]) {
      if (order.sessionId === id) this.orders.delete(order._id);
    }
  }

  async listKiosks(): Promise<KioskRecord[]> {
    return structuredClone([...this.kiosks.values()]);
  }

  async putKiosk(record: KioskRecord): Promise<void> {
    for (const other of this.kiosks.values()) {
      if (other.code === record.code && other._id !== record._id) {
        throw new Error(`The kiosk ${other._id} already has the code ${record.code}.`);
      }
    }
    this.kiosks.set(record._id, structuredClone(record));
  }

  async insertOrder(order: OrderRecord): Promise<void> {
    if (this.orders.has(order._id)) throw new Error(`The order ${order._id} already exists.`);
    this.orders.set(order._id, structuredClone(order));
  }

  async listOrders(sessionId: string): Promise<OrderRecord[]> {
    return structuredClone([...this.orders.values()].filter((order) => order.sessionId === sessionId));
  }

  async getClip(hash: string): Promise<ClipRecord | null> {
    return structuredClone(this.clips.get(hash) ?? null);
  }

  async putClip(clip: ClipRecord): Promise<void> {
    this.clips.set(clip._id, structuredClone(clip));
  }

  async close(): Promise<void> {}

  private setProducts(products: Product[]): void {
    this.products = structuredClone(products).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
