import { type Collection, type Db, MongoClient } from 'mongodb';
import type { Product } from '@glance/shared';
import type { ClipRecord, KioskRecord, OrderRecord, SessionRecord, Store } from './store';

/** A product in the database: `_id` holds the product ID, and the document has no `id` field. */
type ProductDocument = Omit<Product, 'id'> & { _id: string };

const SERVER_SELECTION_TIMEOUT_MS = 5000;

/** Keeps the data in MongoDB, in the collections of spec section 8.6. */
export class MongoStore implements Store {
  private readonly products: Collection<ProductDocument>;
  private readonly sessions: Collection<SessionRecord>;
  private readonly kiosks: Collection<KioskRecord>;
  private readonly orders: Collection<OrderRecord>;
  private readonly clips: Collection<ClipRecord>;

  private constructor(private readonly client: MongoClient, private readonly db: Db) {
    this.products = db.collection('products');
    this.sessions = db.collection('sessions');
    this.kiosks = db.collection('kiosks');
    this.orders = db.collection('orders');
    this.clips = db.collection('speech_clips');
  }

  /** Connects and creates the indexes. Rejects after 5 seconds when no server answers. */
  static async connect(uri: string, dbName: string): Promise<MongoStore> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
    try {
      await client.connect();
      const store = new MongoStore(client, client.db(dbName));
      await store.kiosks.createIndex({ code: 1 }, { unique: true });
      await store.orders.createIndex({ sessionId: 1 });
      return store;
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  async listProducts(): Promise<Product[]> {
    const documents = await this.products.find().sort({ _id: 1 }).toArray();
    return documents.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  }

  /** Not atomic: a reader between the two steps sees no product. Only the seed command calls it. */
  async replaceProducts(products: Product[]): Promise<void> {
    await this.products.deleteMany({});
    if (products.length === 0) return;
    await this.products.insertMany(products.map(({ id, ...rest }) => ({ _id: id, ...rest })));
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return this.sessions.findOne({ _id: id });
  }

  async putSession(record: SessionRecord): Promise<void> {
    const { _id, ...fields } = record;
    await this.sessions.replaceOne({ _id }, fields, { upsert: true });
  }

  async deleteSession(id: string): Promise<void> {
    await this.orders.deleteMany({ sessionId: id });
    await this.sessions.deleteOne({ _id: id });
  }

  async listKiosks(): Promise<KioskRecord[]> {
    return this.kiosks.find().toArray();
  }

  /** The unique index on `code` rejects a second kiosk with the same code. */
  async putKiosk(record: KioskRecord): Promise<void> {
    const { _id, ...fields } = record;
    await this.kiosks.replaceOne({ _id }, fields, { upsert: true });
  }

  async insertOrder(order: OrderRecord): Promise<void> {
    await this.orders.insertOne(order);
  }

  async listOrders(sessionId: string): Promise<OrderRecord[]> {
    return this.orders.find({ sessionId }).toArray();
  }

  async getClip(hash: string): Promise<ClipRecord | null> {
    return this.clips.findOne({ _id: hash });
  }

  async putClip(clip: ClipRecord): Promise<void> {
    await this.clips.replaceOne({ _id: clip._id }, { path: clip.path }, { upsert: true });
  }

  /** For a test that makes a database of its own. */
  async dropDatabase(): Promise<void> {
    await this.db.dropDatabase();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
