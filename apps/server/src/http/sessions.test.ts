import { afterEach, beforeEach, expect, it } from 'vitest';
import { CreateSessionResponseSchema, EMPTY_CART, SessionSnapshotSchema, parseServerEvent } from '@glance/shared';
import { NO_RESULT } from '../recognition/result';
import type { RuleInputBody } from '../sessions/types';
import { type TestApp, eventReader, testApp } from '../testing';
import { deviceSocketUrl } from './sessions';

const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
/** 2 results in a row: sight opens the prompt of the oat drink with the second one. */
const showOat = (session: { dispatch(input: RuleInputBody): void }): void => {
  session.dispatch(seeOat);
  session.dispatch(seeOat);
};

let t: TestApp;
let id: string;
let token: string;
let abort: AbortController;

const send = (method: string, path: string, body?: unknown) => fetch(`${t.base}${path}`, {
  method,
  signal: abort.signal,
  ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
});
const get = (path: string) => send('GET', path);
const post = (path: string, body: unknown) => send('POST', path, body);
const patch = (path: string, body: unknown) => send('PATCH', path, body);
const del = (path: string) => send('DELETE', path);

beforeEach(async () => {
  t = await testApp();
  abort = new AbortController();
  const created = CreateSessionResponseSchema.parse(await (await post('/api/sessions', { profile: { detail: 'brief' } })).json());
  id = created.sessionId;
  token = created.token;
});
afterEach(async () => {
  abort.abort();
  await t.close();
});

it('creates a session', async () => {
  const res = await post('/api/sessions', { profile: { detail: 'brief' } });
  expect(res.status).toBe(201);
  const body = CreateSessionResponseSchema.parse(await res.json());
  expect(body.wsUrl).toBe(`${t.wsBase}/ws/device?session=${body.sessionId}&token=${body.token}`);
});
it('creates a session with the default profile when the call has no body', async () => {
  const res = await send('POST', '/api/sessions');
  expect(res.status).toBe(201);
  const { sessionId } = CreateSessionResponseSchema.parse(await res.json());
  expect((await t.app.sessions.get(sessionId))!.state.profile.detail).toBe('standard');
});
it('builds the socket address from the public address', () => {
  expect(deviceSocketUrl('https://glance.example/', 's1', 't1')).toBe('wss://glance.example/ws/device?session=s1&token=t1');
  expect(deviceSocketUrl('http://localhost:8080', 's1', 't1')).toBe('ws://localhost:8080/ws/device?session=s1&token=t1');
});
it('returns a snapshot that passes the shared schema', async () => {
  const snapshot = SessionSnapshotSchema.parse(await (await get(`/api/sessions/${id}?token=${token}`)).json());
  expect(snapshot).toMatchObject({ sessionId: id, phase: 'shopping', cart: EMPTY_CART, profile: { detail: 'brief' } });
});
it('patches the profile, drops an unknown key, and rejects a bad value', async () => {
  const ok = await patch(`/api/sessions/${id}/profile?token=${token}`, { speechRate: 1.5, foo: 1 });
  expect(ok.status).toBe(200);
  const profile = await ok.json();
  expect(profile).toMatchObject({ speechRate: 1.5, detail: 'brief' });
  expect(profile).not.toHaveProperty('foo');
  const bad = await patch(`/api/sessions/${id}/profile?token=${token}`, { speechRate: 3 });
  expect(bad.status).toBe(400);
  expect(await bad.json()).toEqual({ error: 'bad_request' });
});
it('takes a yes from a web client', async () => {
  const session = (await t.app.sessions.get(id))!;
  showOat(session);
  const res = await post(`/api/sessions/${id}/intents?token=${token}`, { kind: 'yes', source: 'phone', promptId: 'p-0001' });
  expect(res.status).toBe(204);
  expect(session.state.cart.totalCents).toBe(189);
});
it('edits the cart', async () => {
  const session = (await t.app.sessions.get(id))!;
  showOat(session);
  session.dispatch({ type: 'intent', kind: 'yes', source: 'phone', promptId: 'p-0001' });
  expect((await post(`/api/sessions/${id}/cart?token=${token}`, { productId: 'oat-drink-1l', qty: 0 })).status).toBe(204);
  expect(session.state.cart).toEqual(EMPTY_CART);
});
it('streams the events of a session with the CORS header', async () => {
  const res = await get(`/api/sessions/${id}/events?token=${token}`);
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  expect(res.headers.get('cache-control')).toBe('no-cache');
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  showOat((await t.app.sessions.get(id))!);
  expect(parseServerEvent(await eventReader(res).next())?.type).toBe('glance.pending');
});
it('deletes a session with its data', async () => {
  expect((await del(`/api/sessions/${id}?token=${token}`)).status).toBe(204);
  expect((await get(`/api/sessions/${id}?token=${token}`)).status).toBe(404);
  expect(await t.store.getSession(id)).toBeNull();
});
it('takes a DELETE that has the JSON content type and no body', async () => {
  const res = await fetch(`${t.base}/api/sessions/${id}?token=${token}`, {
    method: 'DELETE', headers: { 'content-type': 'application/json' },
  });
  expect(res.status).toBe(204);
});
it('ends the events stream of a session that a client deletes', async () => {
  const res = await get(`/api/sessions/${id}/events?token=${token}`);
  await del(`/api/sessions/${id}?token=${token}`);
  await expect(eventReader(res).next()).rejects.toThrow('The events stream ended.');
});
it('keeps the events stream of an ended session open', async () => {
  const session = (await t.app.sessions.get(id))!;
  session.dispatch({ type: 'intent', kind: 'stop', source: 'phone' });
  await session.settled();
  expect(session.stopped).toBe(true);
  const res = await get(`/api/sessions/${id}/events?token=${token}`);
  const first = await res.body!.getReader().read();
  expect(new TextDecoder().decode(first.value)).toBe(': ping\n\n');
  expect(SessionSnapshotSchema.parse(await (await get(`/api/sessions/${id}?token=${token}`)).json()).phase).toBe('ended');
});
it('answers 400 for a bad body and 404 for an unknown session', async () => {
  expect((await post(`/api/sessions/${id}/intents?token=${token}`, { kind: 'maybe', source: 'phone' })).status).toBe(400);
  expect((await post(`/api/sessions/${id}/intents?token=${token}`, { kind: 'yes', source: 'head' })).status).toBe(400);
  expect((await post(`/api/sessions/${id}/cart?token=${token}`, { productId: 'oat-drink-1l', qty: -1 })).status).toBe(400);
  expect((await post('/api/sessions', { profile: { detail: 'loud' } })).status).toBe(400);
  const missing = await get('/api/sessions/nope?token=x');
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: 'not_found' });
  expect((await get('/api/sessions/nope/events?token=x')).status).toBe(404);
  expect((await del('/api/sessions/nope?token=x')).status).toBe(404);
});
it('closes while a client is on the events stream', async () => {
  const res = await fetch(`${t.base}/api/sessions/${id}/events?token=${token}`);
  await res.body!.getReader().read().catch(() => undefined);   // the stream is open
  await expect(Promise.race([t.close(), new Promise((_, no) => setTimeout(no, 2000))])).resolves.toBeUndefined();
});
