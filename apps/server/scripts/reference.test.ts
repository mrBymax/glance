import { afterEach, beforeEach, expect, it } from 'vitest';
import { CreateSessionResponseSchema } from '@glance/shared';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../src/testing';
import { runReference } from './reference';

const NUTELLA = '3017624010701';
const JPEG = new Uint8Array([0xff, 0xd8, 0x01, 0xff, 0xd9]);
const label = { seq: 9, ts: 9, w: 1080, h: 1440, blurred: true, kind: 'label' as const };

let t: TestApp;
let phones: TestPhone[];
const env = () => ({ DEMO_KEY: 'k-demo', PUBLIC_BASE_URL: t.base });

async function phone(): Promise<TestPhone> {
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${t.base}/api/sessions`, { method: 'POST' })).json());
  const connected = await connectPhone(t, created.sessionId, created.token);
  phones.push(connected);
  await connected.next((m) => m.t === 'snapshot');
  return connected;
}

beforeEach(async () => {
  phones = [];
  t = await testApp({ DEMO_KEY: 'k-demo' });
});
afterEach(async () => {
  for (const connected of phones) connected.close();
  await t.close();
});

it('asks the server for a reference picture and prints the file and the size', async () => {
  const shopper = await phone();
  const run = runReference([NUTELLA], env());
  await shopper.next((m) => m.t === 'still.request');
  shopper.sendFrame(label, JPEG);
  const { ok, lines } = await run;
  expect(ok).toBe(true);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/^reference: saved \d+\.jpg for 3017624010701 Nutella, 1080 x 1440, 5 bytes, 1 picture$/);
});
it('lists each store item with its picture count', async () => {
  const { ok, lines } = await runReference(['list'], env());
  expect(ok).toBe(true);
  expect(lines).toHaveLength(11);
  expect(lines[0]).toBe('3017624010701  0  Nutella');
  expect(lines.at(-1)).toBe('reference: 10 items, 0 pictures');
});
it('removes the pictures of one item', async () => {
  expect(await runReference(['remove', NUTELLA], env())).toEqual({ ok: true, lines: ['reference: removed 0 pictures of 3017624010701'] });
});
it('takes the address from --url, before PUBLIC_BASE_URL', async () => {
  const { ok } = await runReference(['list', '--url', t.base], { DEMO_KEY: 'k-demo', PUBLIC_BASE_URL: 'http://127.0.0.1:1' });
  expect(ok).toBe(true);
});
it('says what to do for each failure, and never prints the key', async () => {
  const cases: [string[], Record<string, string>, RegExp][] = [
    [[NUTELLA], { PUBLIC_BASE_URL: t.base }, /DEMO_KEY is not set/],
    [[], env(), /give a code/],
    [[NUTELLA], { ...env(), DEMO_KEY: 'wrong' }, /answered 404.*DEMO_KEY/],
    [['3017624010702'], env(), /answered 400.*check digit.*store list/],
    [[NUTELLA], env(), /no live session/],
    [['list'], { DEMO_KEY: 'k-demo', PUBLIC_BASE_URL: 'http://127.0.0.1:1' }, /no answer from http:\/\/127\.0\.0\.1:1/],
  ];
  for (const [args, vars, message] of cases) {
    const { ok, lines } = await runReference(args, vars);
    expect(ok, message.source).toBe(false);
    expect(lines.join('\n')).toMatch(message);
    expect(lines.join('\n')).not.toContain('k-demo');
  }
  await fetch(`${t.base}/api/sessions`, { method: 'POST' });
  expect((await runReference([NUTELLA], env())).lines.join('\n')).toMatch(/no phone/);
});
