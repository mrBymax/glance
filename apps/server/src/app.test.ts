import { fileURLToPath } from 'node:url';
import { afterAll, expect, it } from 'vitest';
import { type AppDeps, buildApp } from './app';
import { indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { loadConfig } from './config';
import { MemoryStore } from './db/memory';

const products = readCatalogFile(fileURLToPath(new URL('../catalog/catalog.dev.json', import.meta.url)));
const deps = (): AppDeps => ({
  config: loadConfig({}, ['--fake']), clock: systemClock, store: new MemoryStore(products), catalog: indexCatalog(products), log: false,
});

const app = await buildApp(deps());
afterAll(() => app.close());

it('answers the health check', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  expect(res.json()).toEqual({ ok: true, fakeRecognition: true, fakeSpeech: true, store: 'memory', saveFrames: false });
});
it('names the MongoDB store in the health check as the start log does', async () => {
  // buildApp opens no connection: the store of the test stays the memory store.
  const withUri = await buildApp({ ...deps(), config: loadConfig({ MONGODB_URI: 'mongodb://127.0.0.1:1/none' }, ['--fake']) });
  try {
    expect((await withUri.inject({ method: 'GET', url: '/healthz' })).json()).toMatchObject({ store: 'mongo' });
  } finally {
    await withUri.close();
  }
});
it('answers a preflight request and sets the CORS header', async () => {
  const res = await app.inject({ method: 'OPTIONS', url: '/api/sessions',
    headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' } });
  expect(res.statusCode).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe('*');
  expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE');
  expect(res.headers['access-control-allow-headers']).toBe('content-type');
});
it('answers an unknown path with a JSON error', async () => {
  const res = await app.inject({ method: 'GET', url: '/nope' });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: 'not_found' });
  expect(res.headers['access-control-allow-origin']).toBe('*');
});
it('answers a body that fails to parse with 400', async () => {
  const res = await app.inject({ method: 'POST', url: '/healthz',
    headers: { 'content-type': 'application/json' }, payload: '{"a":' });
  expect(res.statusCode).toBe(400);
  expect(res.json()).toEqual({ error: 'bad_request' });
});
it('runs each close function when the app closes', async () => {
  const other = await buildApp(deps());
  let closed = 0;
  other.closers.add(() => { closed += 1; });
  await other.close();
  expect(closed).toBe(1);
});
