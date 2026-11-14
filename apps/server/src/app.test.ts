import { afterAll, expect, it } from 'vitest';
import { buildApp } from './app';
import { systemClock } from './clock';
import { loadConfig } from './config';

const app = await buildApp({ config: loadConfig({}, ['--fake']), clock: systemClock, log: false });
afterAll(() => app.close());

it('answers the health check', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  expect(res.json()).toEqual({ ok: true, fakeRecognition: true, fakeSpeech: true, store: 'memory' });
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
  const other = await buildApp({ config: loadConfig({}, ['--fake']), clock: systemClock, log: false });
  let closed = 0;
  other.closers.add(() => { closed += 1; });
  await other.close();
  expect(closed).toBe(1);
});
