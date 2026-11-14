import { afterEach, beforeEach, expect, it } from 'vitest';
import { type TestApp, testApp } from '../src/testing';
import { runSmoke } from './smoke';

const STEPS = ['health', 'session', 'socket', 'events', 'line', 'caption', 'delete'];

let t: TestApp;
beforeEach(async () => {
  t = await testApp();
});
afterEach(() => t.close());

it('passes against a local server', async () => {
  const result = await runSmoke(t.base);
  expect(result.steps.map((s) => s.name)).toEqual(STEPS);
  expect(result.ok).toBe(true);
  expect(t.app.sessions.live()).toEqual([]);
});
it('passes against a server with fake recognition, and with a slash at the end of the address', async () => {
  const fake = await testApp({ FAKE_RECOGNITION: '1' });
  try {
    const result = await runSmoke(`${fake.base}/`);
    expect(result.steps.filter((s) => !s.ok)).toEqual([]);
    expect(result.ok).toBe(true);
  } finally {
    await fake.close();
  }
});
it('fails at the first step when no server answers', async () => {
  const result = await runSmoke('http://127.0.0.1:9');
  expect(result.ok).toBe(false);
  expect(result.steps).toMatchObject([{ name: 'health', ok: false }]);
  expect(result.steps[0]!.detail).toBeTruthy();
});
it('fails at the socket step when the server gives a socket address that does not answer, and deletes its session', async () => {
  const wrong = await testApp({ PUBLIC_BASE_URL: 'http://127.0.0.1:9' });
  try {
    const result = await runSmoke(wrong.base);
    expect(result.ok).toBe(false);
    expect(result.steps.map((s) => [s.name, s.ok])).toEqual([['health', true], ['session', true], ['socket', false]]);
    expect(wrong.app.sessions.live()).toEqual([]);
  } finally {
    await wrong.close();
  }
});
