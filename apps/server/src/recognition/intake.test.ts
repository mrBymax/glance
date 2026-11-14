import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema } from '@glance/shared';
import { type TestApp, type TestPhone, connectPhone, testApp } from '../testing';
import type { Recognizer } from './gemini';
import { NO_RESULT, type RecognitionResult } from './result';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const ok: RecognitionResult = { ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.9 };

let recognize: ReturnType<typeof vi.fn<Recognizer['recognize']>>;
let logLines: string[];
let apps: TestApp[];
let t: TestApp;
let sessionId: string;
let token: string;
let phone: TestPhone;

/** A test app with the stub recognizer, one session, and its phone. The log lines go to `logLines`. */
async function appWithPhone(env: Record<string, string> = {}): Promise<{ t: TestApp; sessionId: string; token: string; phone: TestPhone }> {
  const app = await testApp(env, {
    recognizer: { recognize },
    log: { level: 'info', stream: { write: (line) => { logLines.push(line); } } },
  });
  apps.push(app);
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${app.base}/api/sessions`, { method: 'POST' })).json());
  const appPhone = await connectPhone(app, created.sessionId, created.token);
  await appPhone.next((m) => m.t === 'snapshot');
  return { t: app, sessionId: created.sessionId, token: created.token, phone: appPhone };
}
const logged = (text: string) => logLines.filter((line) => line.includes(text)).length;

beforeEach(async () => {
  recognize = vi.fn<Recognizer['recognize']>(async () => ok);
  logLines = [];
  apps = [];
  ({ t, sessionId, token, phone } = await appWithPhone());
});
afterEach(async () => {
  for (const app of apps) await app.close();
});

it('a frame from the phone becomes a spoken glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', promptId: 'p-0001',
  });
});
it('gives the recognizer the JPEG of the frame, and tells a still from a frame', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.sendFrame({ seq: 2, ts: 2, w: 1440, h: 1080, blurred: true, kind: 'still' }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect([...recognize.mock.calls[0]![0]]).toEqual([...JPEG]);
  expect(recognize.mock.calls.map((call) => call[1].still)).toEqual([false, true]);
});
it('logs the status and the time of each call', async () => {
  phone.sendFrame({ seq: 5, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  expect(logLines.join('')).toMatch(new RegExp(`recognition session=${sessionId} seq=5 status=identified ms=\\d+`));
});
it('a frame with blurred false still becomes a glance', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  await phone.next((m) => m.t === 'speak');
  expect(recognize).toHaveBeenCalledTimes(1);
});
it('warns one time for each session about frames that are not blurred', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: false }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(logged('frame not blurred: the phone did not run face detection')).toBe(1);
});
it('with REQUIRE_BLUR a frame with blurred false never reaches the recognizer', async () => {
  const strict = await appWithPhone({ REQUIRE_BLUR: '1' });
  strict.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: false }, JPEG);
  strict.phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: false }, JPEG);
  strict.phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  await strict.phone.next((m) => m.t === 'speak');
  expect(recognize).not.toHaveBeenCalled();
  expect(logged('frame dropped: not blurred')).toBe(1);
});
it('with REQUIRE_BLUR a blurred frame still becomes a glance', async () => {
  const strict = await appWithPhone({ REQUIRE_BLUR: '1' });
  strict.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  expect(await strict.phone.next((m) => m.t === 'speak')).toMatchObject({ promptId: 'p-0001' });
});
it('the call excludes a product that the shopper just skipped', async () => {
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await phone.next((m) => m.t === 'speak');
  phone.send({ t: 'intent', kind: 'no', source: 'phone', promptId: 'p-0001' });
  await phone.next((m) => m.t === 'speak' && m.text === 'Skipped.');
  phone.sendFrame({ seq: 2, ts: 2, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(recognize.mock.calls[1]![1].exclude).toEqual(['oat-drink-1l']);
});
it('reports a recognizer that fails 3 times in a row, and keeps the socket open', async () => {
  recognize.mockRejectedValue(new Error('503 overloaded'));
  for (const seq of [1, 2, 3]) {
    phone.sendFrame({ seq, ts: seq, w: 576, h: 768, blurred: true }, JPEG);
    await vi.waitFor(() => expect(logged(`recognition call failed. seq=${seq} Error: 503 overloaded`)).toBe(1));
  }
  expect(logged(`recognition is slow for the session ${sessionId}`)).toBe(1);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({ text: 'Recognition is slow right now.', priority: 'high' });
  expect(await phone.next((m) => m.t === 'event' && m.event.type === 'error')).toMatchObject({ event: { code: 'recognition.slow' } });
  phone.send({ t: 'intent', kind: 'help', source: 'phone' });
  expect(await phone.next((m) => m.t === 'speak' && m.priority === 'low')).toBeDefined();
});
it('ends the call of a session that a client deletes', async () => {
  let signal: AbortSignal | null = null;
  recognize.mockImplementationOnce((_jpeg, opts) => {
    signal = opts.signal;
    return new Promise(() => undefined);
  });
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(signal).not.toBeNull());
  await fetch(`${t.base}/api/sessions/${sessionId}?token=${token}`, { method: 'DELETE' });
  await vi.waitFor(() => expect(signal!.aborted).toBe(true));
});
it('ends each call when the app closes', async () => {
  let signal: AbortSignal | null = null;
  recognize.mockImplementationOnce((_jpeg, opts) => {
    signal = opts.signal;
    return new Promise(() => undefined);
  });
  phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await vi.waitFor(() => expect(signal).not.toBeNull());
  await t.close();
  expect(signal!.aborted).toBe(true);
});
it('with SECOND_LOOK_WAIT_MS the look-alike line waits, and a sure still gives the glance in its place', async () => {
  const ambiguous: RecognitionResult = { ...NO_RESULT, status: 'ambiguous', candidates: ['oat-drink-1l', 'oat-drink-barista-1l'] };
  recognize.mockImplementation(async (_jpeg, opts) => (opts.still ? ok : ambiguous));
  const waiting = await appWithPhone({ SECOND_LOOK_WAIT_MS: '10000' });
  waiting.phone.sendFrame({ seq: 1, ts: 1, w: 576, h: 768, blurred: true }, JPEG);
  await waiting.phone.next((m) => m.t === 'event' && m.event.type === 'glance.ambiguous');
  waiting.phone.sendFrame({ seq: 2, ts: 2, w: 1440, h: 1080, blurred: true, kind: 'still' }, JPEG);
  await waiting.phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  await waiting.phone.next((m) => m.t === 'speak');
  expect(waiting.phone.messages.flatMap((m) => (m.t === 'speak' ? [m.text] : []))).toEqual(['Oat drink, one litre, one eighty-nine. Nod to add.']);
});
