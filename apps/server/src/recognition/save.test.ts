import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyBaseLogger } from 'fastify';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, DEFAULT_PROFILE } from '@glance/shared';
import { systemClock } from '../clock';
import type { SessionRuntime } from '../sessions/runtime';
import { createSessionState } from '../sessions/step';
import { type TestApp, connectPhone, testApp } from '../testing';
import type { Recognizer } from './gemini';
import { createFrameHandler } from './intake';
import { NO_RESULT } from './result';
import { type FrameSaver, createFrameSaver } from './save';
import type { Frame } from './worker';

const SOURCE_DIR = fileURLToPath(new URL('..', import.meta.url));

/** The bytes between the two JPEG markers hold the sequence number, so each frame differs. */
const frame = (seq: number, bytes = 8): Frame => {
  const jpeg = new Uint8Array(bytes).fill(seq);
  jpeg.set([0xff, 0xd8], 0);
  jpeg.set([0xff, 0xd9], bytes - 2);
  return { header: { seq, ts: seq, w: 576, h: 768, blurred: true }, jpeg };
};

let dir: string;
let recognize: ReturnType<typeof vi.fn<Recognizer['recognize']>>;
let logLines: string[];
let apps: TestApp[];

/** What the frame handler reads of a session. */
const fakeSession = (id = 's1'): SessionRuntime => ({
  id, stopped: false, state: createSessionState(DEFAULT_PROFILE, 0), onStop: () => () => undefined, dispatch: () => undefined,
} as unknown as SessionRuntime);

const handlerWith = (saveFrame: FrameSaver | null) => {
  const write = (line: string): void => { logLines.push(line); };
  const log = { debug: write, info: write, warn: write, error: write } as unknown as FastifyBaseLogger;
  return createFrameHandler({ recognizerFor: () => ({ recognize }), concurrency: 3, clock: systemClock, log, onCode: () => undefined, resolveProduct: () => null, onSlow: () => undefined, requireBlur: false, saveFrame });
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'glance-frames-'));
  recognize = vi.fn<Recognizer['recognize']>(async () => NO_RESULT);
  logLines = [];
  apps = [];
});
afterEach(async () => {
  for (const app of apps) await app.close();
  rmSync(dir, { recursive: true, force: true });
});

it('the frame saver writes the JPEG under the session ID and the sequence number', async () => {
  await createFrameSaver(dir)('s1', frame(7));
  expect(new Uint8Array(readFileSync(join(dir, 's1', '7.jpg')))).toEqual(frame(7).jpeg);
});
it('the frame saver takes no session ID that leaves its folder', async () => {
  await expect(createFrameSaver(dir)('../up', frame(1))).rejects.toThrow('no safe folder name');
  await expect(createFrameSaver(dir)('', frame(1))).rejects.toThrow('no safe folder name');
  expect(readdirSync(dir)).toEqual([]);
});
it('the frame handler saves a frame only when it has a saver', async () => {
  const saver = vi.fn<FrameSaver>(async () => undefined);
  handlerWith(saver)(fakeSession(), frame(1));
  handlerWith(null)(fakeSession(), frame(2));
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(2));
  expect(saver).toHaveBeenCalledTimes(1);
  expect(saver.mock.calls[0]![0]).toBe('s1');
  expect(saver.mock.calls[0]![1]).toEqual(frame(1));
});
it('a frame that the handler drops is not saved', async () => {
  const saver = vi.fn<FrameSaver>(async () => undefined);
  const write = (line: string): void => { logLines.push(line); };
  const strict = createFrameHandler({
    recognizerFor: () => ({ recognize }), concurrency: 3, clock: systemClock, log: { debug: write, info: write, warn: write } as unknown as FastifyBaseLogger,
    onCode: () => undefined, resolveProduct: () => null, onSlow: () => undefined, requireBlur: true, saveFrame: saver,
  });
  strict(fakeSession(), { ...frame(1), header: { ...frame(1).header, blurred: false } });
  strict({ ...fakeSession(), stopped: true } as unknown as SessionRuntime, frame(2));
  expect(saver).not.toHaveBeenCalled();
  expect(recognize).not.toHaveBeenCalled();
});
it('a write that fails is logged, and the recognition call goes on', async () => {
  handlerWith(async () => { throw new Error('disk full'); })(fakeSession(), frame(3));
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(logLines.filter((line) => line.includes('frame not saved. seq=3 disk full'))).toHaveLength(1));
});
it('only the frame saver imports the file system on the frame path', () => {
  for (const file of ['ws/device.ts', 'recognition/intake.ts', 'recognition/worker.ts', 'recognition/gemini.ts']) {
    expect(readFileSync(join(SOURCE_DIR, file), 'utf8')).not.toMatch(/node:fs|['"]fs['"]|fs\/promises/);
  }
  expect(readFileSync(join(SOURCE_DIR, 'recognition/save.ts'), 'utf8')).toMatch(/node:fs/);
});
it('logs the header of a frame and never its bytes', async () => {
  handlerWith(null)(fakeSession(), frame(9, 50_000));
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));
  expect(logLines.filter((line) => line.includes('frame seq=9 w=576 h=768 blurred=true kind=frame bytes=50000'))).toHaveLength(1);
  expect(Math.max(...logLines.map((line) => line.length))).toBeLessThan(500);
});

/** A test app with one session and its phone. */
async function appWithPhone(env: Record<string, string>, saveFrame?: FrameSaver) {
  const t = await testApp(env, {
    recognizer: { recognize },
    log: { level: 'debug', stream: { write: (line) => { logLines.push(line); } } },
    ...(saveFrame ? { saveFrame } : {}),
  });
  apps.push(t);
  const created = CreateSessionResponseSchema.parse(await (await fetch(`${t.base}/api/sessions`, { method: 'POST' })).json());
  const phone = await connectPhone(t, created.sessionId, created.token);
  await phone.next((m) => m.t === 'snapshot');
  return { t, sessionId: created.sessionId, phone };
}

it('with no saver the server writes no frame and logs no bytes', async () => {
  const { t, phone } = await appWithPhone({ SAVE_FRAMES: '' });
  phone.sendFrame(frame(1, 50_000).header, frame(1, 50_000).jpeg);
  await vi.waitFor(() => expect(recognize).toHaveBeenCalledTimes(1));
  expect(await (await fetch(`${t.base}/healthz`)).json()).toMatchObject({ saveFrames: false });
  expect(readdirSync(dir)).toEqual([]);
  expect(logLines.some((line) => line.includes('bytes=50000'))).toBe(true);
  expect(Math.max(...logLines.map((line) => line.length))).toBeLessThan(1000);
});
it('with a saver the server writes each frame of the phone', async () => {
  const { t, sessionId, phone } = await appWithPhone({ SAVE_FRAMES: dir }, createFrameSaver(dir));
  phone.sendFrame(frame(4).header, frame(4).jpeg);
  await vi.waitFor(() => expect(existsSync(join(dir, sessionId, '4.jpg'))).toBe(true));
  await vi.waitFor(() => expect(new Uint8Array(readFileSync(join(dir, sessionId, '4.jpg')))).toEqual(frame(4).jpeg));
  expect(await (await fetch(`${t.base}/healthz`)).json()).toMatchObject({ saveFrames: true });
});
it('with fake recognition and a saver the server writes each frame and makes no recognition call', async () => {
  const { sessionId, phone } = await appWithPhone({ SAVE_FRAMES: dir, FAKE_RECOGNITION: '1' }, createFrameSaver(dir));
  phone.sendFrame(frame(5).header, frame(5).jpeg);
  await vi.waitFor(() => expect(existsSync(join(dir, sessionId, '5.jpg'))).toBe(true));
  expect(recognize).not.toHaveBeenCalled();
});
it('with fake recognition and REQUIRE_BLUR the server writes no frame that is not blurred', async () => {
  const { sessionId, phone } = await appWithPhone({ SAVE_FRAMES: dir, FAKE_RECOGNITION: '1', REQUIRE_BLUR: '1' }, createFrameSaver(dir));
  phone.sendFrame({ ...frame(6).header, blurred: false }, frame(6).jpeg);
  phone.sendFrame(frame(7).header, frame(7).jpeg);
  await vi.waitFor(() => expect(existsSync(join(dir, sessionId, '7.jpg'))).toBe(true));
  expect(readdirSync(join(dir, sessionId))).toEqual(['7.jpg']);
});
