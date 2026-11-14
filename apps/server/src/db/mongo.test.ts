import { randomBytes } from 'node:crypto';
import { describe } from 'vitest';
import { storeContract } from './contract';
import { MongoStore } from './mongo';

const uri = process.env.MONGODB_URI_TEST;

// This test needs a MongoDB server. Without MONGODB_URI_TEST it is skipped.
describe.skipIf(!uri)('with a MongoDB server', () => {
  storeContract('MongoStore', async () => {
    const store = await MongoStore.connect(uri!, `glance-test-${randomBytes(6).toString('hex')}`);
    const close = store.close.bind(store);
    store.close = async () => {
      await store.dropDatabase();
      await close();
    };
    return store;
  });
});
