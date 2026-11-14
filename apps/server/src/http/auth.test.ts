import { afterEach, beforeEach, expect, it } from 'vitest';
import { type CreateKioskResponse, CreateKioskResponseSchema, CreateSessionResponseSchema } from '@glance/shared';
import { type TestApp, testApp, upgradeStatus } from '../testing';
import { tokenMatches } from './auth';

let t: TestApp;
let id: string;
let token: string;
let kiosk: CreateKioskResponse;
let abort: AbortController;
let logLines: string[];

const call = (method: string, path: string) => fetch(`${t.base}${path}`, {
  method,
  signal: abort.signal,
  ...(method === 'POST' || method === 'PATCH' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
});

beforeEach(async () => {
  logLines = [];
  t = await testApp({}, { log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } } });
  abort = new AbortController();
  ({ sessionId: id, token } = CreateSessionResponseSchema.parse(await (await call('POST', '/api/sessions')).json()));
  const made = await fetch(`${t.base}/api/kiosks`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Checkout 1', store: 'Demo Market' }),
  });
  kiosk = CreateKioskResponseSchema.parse(await made.json());
});
afterEach(async () => {
  abort.abort();
  await t.close();
});

const sessionPaths: [string, (id: string) => string][] = [
  ['GET', (sessionId) => `/api/sessions/${sessionId}`],
  ['PATCH', (sessionId) => `/api/sessions/${sessionId}/profile`],
  ['POST', (sessionId) => `/api/sessions/${sessionId}/intents`],
  ['POST', (sessionId) => `/api/sessions/${sessionId}/cart`],
  ['GET', (sessionId) => `/api/sessions/${sessionId}/events`],
  ['DELETE', (sessionId) => `/api/sessions/${sessionId}`],
];

it.each(sessionPaths)('%s on a session path needs the session token', async (method, path) => {
  const none = await call(method, path(id));
  expect(none.status).toBe(401);
  expect(await none.json()).toEqual({ error: 'unauthorized' });
  expect((await call(method, `${path(id)}?token=wrong`)).status).toBe(401);
  expect((await call(method, `${path(id)}?token=${token}&token=${token}`)).status).toBe(401);
  expect((await call(method, `${path('nope')}?token=${token}`)).status).toBe(404);
});
it('checks the token before the body', async () => {
  // The body {} is no intent and no cart edit.
  expect((await call('POST', `/api/sessions/${id}/intents?token=wrong`)).status).toBe(401);
  expect((await call('POST', `/api/sessions/${id}/intents?token=${token}`)).status).toBe(400);
  expect((await call('POST', `/api/sessions/${id}/cart?token=${token}`)).status).toBe(400);
});
it('the kiosk stream needs the kiosk token', async () => {
  expect((await call('GET', `/api/kiosks/${kiosk.kioskId}/events`)).status).toBe(401);
  expect((await call('GET', `/api/kiosks/${kiosk.kioskId}/events?token=${token}`)).status).toBe(401);
  expect((await call('GET', `/api/kiosks/nope/events?token=${kiosk.token}`)).status).toBe(404);
  const ok = await fetch(`${t.base}/api/kiosks/${kiosk.kioskId}/events?token=${kiosk.token}`, { signal: abort.signal });
  expect(ok.status).toBe(200);
});
it('the socket needs the token', async () => {
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=${id}&token=wrong`)).toBe(401);
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=${id}`)).toBe(401);
  expect(await upgradeStatus(`${t.wsBase}/ws/device?session=nope&token=${token}`)).toBe(404);
});
it('a wrong token changes nothing', async () => {
  await call('DELETE', `/api/sessions/${id}?token=wrong`);
  await call('PATCH', `/api/sessions/${id}/profile?token=wrong`);
  expect((await call('GET', `/api/sessions/${id}?token=${token}`)).status).toBe(200);
});
it('the paths with no token still answer', async () => {
  expect((await call('POST', '/api/sessions')).status).toBe(201);
  expect((await call('GET', '/healthz')).status).toBe(200);
  // 404 and not 401: fake speech has no clip.
  expect((await call('GET', `/api/speech/${'a'.repeat(64)}.mp3`)).status).toBe(404);
});
it('compares a token of each length and type with no throw', () => {
  expect(tokenMatches('abc', 'abc')).toBe(true);
  expect(tokenMatches('abc', 'abd')).toBe(false);
  expect(tokenMatches('abc', 'abcd')).toBe(false);
  expect(tokenMatches('abc', '')).toBe(false);
  expect(tokenMatches('abc', undefined)).toBe(false);
  expect(tokenMatches('abc', ['abc'])).toBe(false);
  // Three characters, and four bytes in UTF-8.
  expect(tokenMatches('abc', 'abç')).toBe(false);
});
it('writes no token to the log', async () => {
  await call('GET', `/api/sessions/${id}?token=${token}`);
  await call('GET', `/api/sessions/${id}?token=wrong-token-value`);
  await upgradeStatus(`${t.wsBase}/ws/device?session=${id}&token=wrong-token-value`);
  const log = logLines.join('\n');
  expect(log).toContain(`/api/sessions/${id}`);
  expect(log).not.toContain(token);
  expect(log).not.toContain('wrong-token-value');
  expect(log).not.toContain(kiosk.token);
});
