import { expect, it } from 'vitest';
import { product } from '../sessions/harness';
import { storeContract } from './contract';
import { MemoryStore } from './memory';

storeContract('MemoryStore', async () => new MemoryStore());

it('starts with the products that it gets', async () => {
  const store = new MemoryStore([product('b-box', 100), product('a-box', 200)]);
  expect((await store.listProducts()).map((p) => p.id)).toEqual(['a-box', 'b-box']);
});
