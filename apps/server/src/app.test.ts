import { fileURLToPath } from 'node:url';
import { afterAll, expect, it, vi } from 'vitest';
import type { ServerEvent } from '@glance/shared';
import { type AppDeps, buildApp } from './app';
import { sessionTopic } from './bus';
import { indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { createFakeProductInfo } from './products/fakeProductInfo';
import { DEFAULT_STORE_LIST_PATH, readStoreListFile } from './products/storeList';
import { NO_RESULT } from './recognition/result';

const products = readCatalogFile(fileURLToPath(new URL('../catalog/catalog.dev.json', import.meta.url)));
const deps = (): AppDeps => ({
  config: loadConfig({}, ['--fake']), clock: systemClock, store: new MemoryStore(products), catalog: indexCatalog(products), log: false,
  storeList: readStoreListFile(DEFAULT_STORE_LIST_PATH), productInfo: createFakeProductInfo(),
});

const app = await buildApp(deps());
afterAll(() => app.close());

it('answers the health check', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  expect(res.json()).toEqual({
    ok: true, fakeRecognition: true, fakeSpeech: true, fakeProductInfo: true, store: 'memory', saveFrames: false,
  });
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
/** Asks one question about the oat drink, and returns the caption that follows "Listening." */
async function askAbout(target: Awaited<ReturnType<typeof buildApp>>, lang: 'en' | 'it'): Promise<string> {
  const session = await target.sessions.create({ lang });
  const captions: string[] = [];
  target.bus.subscribe(sessionTopic(session.id), (message) => {
    const event = message as ServerEvent;
    if (event.type === 'caption') captions.push(event.text);
  });
  session.dispatch({ type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false });
  session.dispatch({ type: 'intent', kind: 'ask', source: 'phone' });
  session.dispatch({ type: 'question', text: 'Does it contain nuts?' });
  await vi.waitFor(() => expect(captions).toHaveLength(3));
  return captions[2]!;
}

it('with fake recognition a question gets one fixed answer, and no answer service runs', async () => {
  const ask = vi.fn<NonNullable<AppDeps['ask']>>(async () => 'From the model.');
  const fake = await buildApp({ ...deps(), ask });
  try {
    expect(await askAbout(fake, 'en')).toBe('I do not have that information.');
    expect(await askAbout(fake, 'it')).toBe('Non ho questa informazione.');
    expect(ask).not.toHaveBeenCalled();
  } finally {
    await fake.close();
  }
});
it('with real recognition and no answer service a question gets the failed line', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const real = await buildApp({ ...deps(), config: loadConfig({ GEMINI_API_KEY: 'test', FAKE_SPEECH: '1' }, []) });
  try {
    expect(await askAbout(real, 'en')).toBe('I could not answer that.');
  } finally {
    await real.close();
    error.mockRestore();
  }
});
it('runs each close function when the app closes', async () => {
  const other = await buildApp(deps());
  let closed = 0;
  other.closers.add(() => { closed += 1; });
  await other.close();
  expect(closed).toBe(1);
});
it('reports a real product reader in the health check', async () => {
  const real = await buildApp({ ...deps(), config: loadConfig({ FAKE_PRODUCT_INFO: '0' }, ['--fake']) });
  try {
    expect((await real.inject({ method: 'GET', url: '/healthz' })).json()).toMatchObject({ fakeProductInfo: false });
  } finally {
    await real.close();
  }
});
