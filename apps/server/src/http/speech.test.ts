import { existsSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema } from '@glance/shared';
import { NO_RESULT } from '../recognition/result';
import type { SessionRuntime } from '../sessions/runtime';
import type { RuleInputBody } from '../sessions/types';
import { clipKey } from '../speech/clips';
import { ELEVENLABS_MODEL, type Synthesize } from '../speech/elevenlabs';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';

// No test of this file reaches ElevenLabs. Each app gets a synthesize function of the test.

const seeOat: RuleInputBody = {
  type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l' }, still: false,
};
const REAL_SPEECH = { FAKE_SPEECH: '0', ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_VOICE_EN: 'voice-en' };
const glanceText = 'Oat drink, one litre, one eighty-nine. Nod to add.';

let synthesize: ReturnType<typeof vi.fn<Synthesize>>;
let apps: TestApp[];
let t: TestApp;

async function speechApp(env: Record<string, string> = REAL_SPEECH): Promise<TestApp> {
  const app = await testApp(env, { synthesize });
  apps.push(app);
  return app;
}
async function shopper(app: TestApp): Promise<{ session: SessionRuntime; phone: TestPhone }> {
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${app.base}/api/sessions`, { method: 'POST' })).json());
  const phone = await connectPhone(app, created.sessionId, created.token);
  await phone.next((m) => m.t === 'snapshot');
  return { session: (await app.app.sessions.get(created.sessionId))!, phone };
}

beforeEach(async () => {
  synthesize = vi.fn<Synthesize>(async () => new Uint8Array([1, 2, 3]));
  apps = [];
  t = await speechApp();
});
afterEach(async () => {
  for (const app of apps) await app.close();
});

it('serves a clip', async () => {
  await t.app.clips.put('a'.repeat(64), new Uint8Array([1, 2, 3]));
  const res = await fetch(`${t.base}/api/speech/${'a'.repeat(64)}.mp3`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('audio/mpeg');
  expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});
it('answers 404 for an unknown clip and for a name that is not a hash', async () => {
  expect((await fetch(`${t.base}/api/speech/${'b'.repeat(64)}.mp3`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/..%2F..%2Fpackage.json`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/%2E%2E%2Fsecret.mp3`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/${'A'.repeat(64)}.mp3`)).status).toBe(404);
  expect((await fetch(`${t.base}/api/speech/${'a'.repeat(64)}.mp3.bak`)).status).toBe(404);
});
it('reads no file for a name that is not a hash', async () => {
  const has = vi.spyOn(t.app.clips, 'has');
  await fetch(`${t.base}/api/speech/..%2F..%2Fpackage.json`);
  expect(has).not.toHaveBeenCalled();
});
it('a line goes out with the address of its clip, and the address gives the clip', async () => {
  const { session, phone } = await shopper(t);
  session.dispatch(seeOat);
  const speak = await phone.next((m) => m.t === 'speak') as { url: string };
  expect(speak.url).toBe(`${t.base}/api/speech/${clipKey(glanceText, 'en', 'voice-en', ELEVENLABS_MODEL)}.mp3`);
  expect(synthesize).toHaveBeenCalledWith(glanceText, 'voice-en');
  expect(new Uint8Array(await (await fetch(speak.url)).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(await phone.next((m) => m.t === 'event' && m.event.type === 'caption')).toMatchObject({ event: { url: speak.url } });
  phone.close();
});
it('with FAKE_SPEECH each line has no clip, the speech path answers 404, and no call goes out', async () => {
  const fake = await speechApp({});
  await fake.app.clips.put('a'.repeat(64), new Uint8Array([1, 2, 3]));
  const { session, phone } = await shopper(fake);
  session.dispatch(seeOat);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({ text: glanceText, url: null });
  expect((await fetch(`${fake.base}/api/speech/${'a'.repeat(64)}.mp3`)).status).toBe(404);
  expect(synthesize).not.toHaveBeenCalled();
  phone.close();
});
it('removes the cache directory of a test app when the app closes', async () => {
  const other = await speechApp();
  await other.app.clips.put('a'.repeat(64), new Uint8Array([1, 2, 3]));
  const path = other.app.clips.path('a'.repeat(64));
  expect(existsSync(path)).toBe(true);
  await other.close();
  expect(existsSync(path)).toBe(false);
});
it('with ElevenLabs down, the line goes out with no clip, and the prompt still takes a yes', async () => {
  synthesize.mockImplementation(async () => { throw new Error('503'); });
  const { session, phone } = await shopper(t);
  session.dispatch(seeOat);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', url: null, promptId: 'p-0001',
  });
  phone.send({ t: 'prompt.done', promptId: 'p-0001' });
  phone.send({ t: 'intent', kind: 'yes', source: 'head', promptId: 'p-0001' });
  expect(await phone.next((m) => m.t === 'speak' && m.text.startsWith('Added'))).toMatchObject({ url: null });
  expect(session.snapshot().captions.map((c) => c.url)).toEqual([null, null]);
  expect(session.state.cart.totalCents).toBe(189);
  phone.close();
});
it('makes the clips of the prompts of each store item at the start, so the first prompt waits for no call', async () => {
  const item = { gtin: '6430062761795', priceCents: 249, name: 'Kili Cascara Yuzu + Sitruuna', brand: 'Kili', packSize: '330 ml' };
  const warm = await testApp({ ...REAL_SPEECH, SPEECH_WARM_UP: '1' }, {
    synthesize, storeList: { byGtin: async (gtin) => (gtin === item.gtin ? item : undefined), all: async () => [item] },
  });
  apps.push(warm);
  await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(3), { timeout: 3000 });
  const made = synthesize.mock.calls.map(([text]) => text);
  expect(made).toEqual([
    'Kili Cascara Yuzu plus Sitruuna, two forty-nine. Nod to add.',
    'Kili Cascara Yuzu plus Sitruuna, two forty-nine.',
    'Kili Cascara Yuzu plus Sitruuna. One is in your cart. Nod to add another. Shake to remove.',
  ]);

  // The first prompt of a session has the yes phrase, and its text is the text of a clip that exists.
  const { session, phone } = await shopper(warm);
  session.dispatch({ type: 'recognition', result: { ...NO_RESULT, status: 'identified', productId: `gtin-${item.gtin}` }, still: false });
  const speak = await phone.next((m) => m.t === 'speak') as { text: string; url: string };
  expect(speak.text).toBe(made[0]);
  expect(speak.url).toBe(`${warm.base}/api/speech/${clipKey(made[0]!, 'en', 'voice-en', ELEVENLABS_MODEL)}.mp3`);
  expect(synthesize.mock.calls.filter(([text]) => text === made[0])).toHaveLength(1);
});
it('makes no clip at the start with SPEECH_WARM_UP=0', async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(synthesize).not.toHaveBeenCalled();
});
