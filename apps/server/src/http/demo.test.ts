import { afterEach, beforeEach, expect, it } from 'vitest';
import { type CreateSessionResponse, CreateSessionResponseSchema, LatestSessionResponseSchema } from '@glance/shared';
import { type TestApp, testApp } from '../testing';

let t: TestApp;
let demo: TestApp;
let logLines: string[];

const callOn = (app: TestApp) => (method: string, path: string) => fetch(`${app.base}${path}`, { method });
const call = (method: string, path: string) => callOn(t)(method, path);
const demoCall = (method: string, path: string) => callOn(demo)(method, path);
const newSession = async (): Promise<CreateSessionResponse> =>
  CreateSessionResponseSchema.parse(await (await demoCall('POST', '/api/sessions')).json());

beforeEach(async () => {
  logLines = [];
  t = await testApp();
  demo = await testApp({ DEMO_KEY: 'k-demo' }, { log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } } });
});
afterEach(async () => {
  await t.close();
  await demo.close();
});

it('gives the newest live session to a caller with the demo key', async () => {
  expect((await demoCall('GET', '/api/demo/latest?key=k-demo')).status).toBe(404);   // no session yet
  const first = await newSession();
  const second = await newSession();
  const latest = LatestSessionResponseSchema.parse(await (await demoCall('GET', '/api/demo/latest?key=k-demo')).json());
  expect(latest).toEqual({ sessionId: second.sessionId, token: second.token });
  await demoCall('DELETE', `/api/sessions/${second.sessionId}?token=${second.token}`);
  const next = LatestSessionResponseSchema.parse(await (await demoCall('GET', '/api/demo/latest?key=k-demo')).json());
  expect(next.sessionId).toBe(first.sessionId);
});
it('answers 404 for a wrong key, for no key, and when DEMO_KEY is not set', async () => {
  await newSession();
  const wrong = await demoCall('GET', '/api/demo/latest?key=wrong');
  expect(wrong.status).toBe(404);
  expect(await wrong.json()).toEqual({ error: 'not_found' });
  expect((await demoCall('GET', '/api/demo/latest')).status).toBe(404);
  await call('POST', '/api/sessions');
  expect((await call('GET', '/api/demo/latest?key=k-demo')).status).toBe(404);   // the first test app has no DEMO_KEY
  expect((await call('GET', '/api/demo/latest?key=')).status).toBe(404);
});
it('does not give a session that has ended', async () => {
  const only = await newSession();
  (await demo.app.sessions.get(only.sessionId))!.dispatch({ type: 'intent', kind: 'stop', source: 'phone' });
  await expect.poll(async () => (await demoCall('GET', '/api/demo/latest?key=k-demo')).status).toBe(404);
});
it('writes no demo key to the log', async () => {
  await newSession();
  await demoCall('GET', '/api/demo/latest?key=k-demo');
  expect(logLines.join('\n')).toContain('/api/demo/latest');
  expect(logLines.join('\n')).not.toContain('k-demo');
});
