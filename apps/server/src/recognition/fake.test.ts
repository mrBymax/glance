import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { CreateSessionResponseSchema, type ServerEvent, TIMING } from '@glance/shared';
import { EventBus } from '../bus';
import { indexCatalog, readCatalogFile } from '../catalog/catalog';
import { systemClock } from '../clock';
import { MemoryStore } from '../db/memory';
import { SessionRegistry } from '../sessions/registry';
import type { SessionRuntime } from '../sessions/runtime';
import { type TestApp, connectPhone, eventReader, testApp } from '../testing';
import { type FakeScript, ScriptPlayer, readFakeScript, scriptAt } from './fake';
import { NO_RESULT } from './result';

const products = readCatalogFile(fileURLToPath(new URL('../../catalog/catalog.dev.json', import.meta.url)));
const catalog = indexCatalog(products);
const script = readFakeScript('fixtures/fake-script.json', catalog);

const tempDir = mkdtempSync(join(tmpdir(), 'glance-fake-'));
let fileCount = 0;
function tempScript(content: unknown): string {
  fileCount += 1;
  const path = join(tempDir, `script-${fileCount}.json`);
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}
const oatStep = { atMs: 100, forMs: 5000, result: { status: 'identified', productId: 'oat-drink-1l' } };

let t: TestApp | null = null;
let abort: AbortController | null = null;

afterEach(async () => {
  vi.useRealTimers();
  abort?.abort();
  abort = null;
  await t?.close();
  t = null;
});
afterAll(() => rmSync(tempDir, { recursive: true, force: true }));

/** A registry with a memory store, a clock that reads Date.now(), and one session. */
async function oneSession(): Promise<SessionRuntime> {
  const registry = new SessionRegistry({
    clock: systemClock, catalog, store: new MemoryStore(products), bus: new EventBus(),
    clipUrl: async () => null, startPayment: () => undefined, ask: async () => '', afterStep: () => undefined,
  });
  return registry.create();
}

async function fakeApp(steps: unknown[]): Promise<{ sessionId: string; token: string }> {
  t = await testApp({ FAKE_RECOGNITION: tempScript({ loop: false, lengthMs: 60000, steps }), GEMINI_API_KEY: '' });
  abort = new AbortController();
  const res = await fetch(`${t.base}/api/sessions`, { method: 'POST', signal: abort.signal });
  return CreateSessionResponseSchema.parse(await res.json());
}

it('reads the default script', () => {
  expect(script).toMatchObject({ loop: true, lengthMs: 60000 });
  expect(script.steps).toHaveLength(7);
  expect(script.label).toBeNull();
});
it('rejects an unknown product ID and names the step', () => {
  const path = tempScript({ loop: true, lengthMs: 1000, steps: [
    oatStep, { atMs: 200, forMs: 100, result: { status: 'identified', productId: 'no-such-product' } },
  ] });
  expect(() => readFakeScript(path, catalog)).toThrow(/step 2.*no-such-product/);
});
it('rejects an unknown candidate and names the step', () => {
  const path = tempScript({ loop: true, lengthMs: 1000, steps: [
    { atMs: 0, forMs: 100, result: { status: 'ambiguous', candidates: ['oat-drink-1l', 'cola-zero'] } },
  ] });
  expect(() => readFakeScript(path, catalog)).toThrow(/step 1.*cola-zero/);
});
it('rejects a step with a bad field, a file that is no JSON, and a missing file', () => {
  const badStep = tempScript({ loop: true, lengthMs: 1000, steps: [oatStep, oatStep, { atMs: 0, forMs: 0, kiosk: 'newest' }] });
  expect(() => readFakeScript(badStep, catalog)).toThrow(/step 3/);
  const typo = tempScript({ loop: true, lengthMs: 1000, steps: [{ atMs: 0, forMs: 100, reslt: { status: 'unknown' } }] });
  expect(() => readFakeScript(typo, catalog)).toThrow(/step 1/);
  expect(() => readFakeScript(tempScript({ loop: true, steps: [] }), catalog)).toThrow(/lengthMs/);
  expect(() => readFakeScript(tempScript('{"loop":'), catalog)).toThrow(/Cannot read the script file/);
  expect(() => readFakeScript(join(tempDir, 'missing.json'), catalog)).toThrow(/Cannot read the script file/);
});
it('gives the result of the step for the elapsed time', () => {
  expect(scriptAt(script, 2999).result).toEqual(NO_RESULT);
  expect(scriptAt(script, 3000).result).toEqual({ ...NO_RESULT, status: 'identified', productId: 'oat-drink-1l', confidence: 0.95 });
  expect(scriptAt(script, 8999).result.productId).toBe('oat-drink-1l');
  expect(scriptAt(script, 9000).result).toEqual(NO_RESULT);
  expect(scriptAt(script, 41000)).toEqual({ result: NO_RESULT, kiosk: 'newest', barcode: null });
  expect(scriptAt(script, 10000)).toEqual({ result: NO_RESULT, kiosk: null, barcode: '8076800195057' });
  expect(scriptAt(script, 12999).barcode).toBe('8076800195057');
  expect(scriptAt(script, 13000).barcode).toBeNull();
});
it('fills the missing fields of each kind of result', () => {
  expect(scriptAt(script, 24000).result).toEqual({ ...NO_RESULT, status: 'unsure', aimHint: 'left', confidence: 0.95 });
  expect(scriptAt(script, 33000).result).toMatchObject({ status: 'ambiguous', candidates: ['oat-drink-1l', 'oat-drink-barista-1l'] });
  expect(scriptAt(script, 3000).kiosk).toBeNull();
});
it('loops', () => {
  expect(scriptAt(script, 63000).result.productId).toBe('oat-drink-1l');
  expect(scriptAt({ ...script, loop: false }, 63000).result).toEqual(NO_RESULT);
});
it('plays the script into a session', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const player = new ScriptPlayer({ script, clock: systemClock, onKiosk: () => undefined, onBarcode: () => undefined, onCode: () => undefined });
  player.start(session, { fakeDevice: true });
  await vi.advanceTimersByTimeAsync(3500);
  expect(session.state.cameraOn).toBe(true);
  expect(session.state.prompt).toMatchObject({ productId: 'oat-drink-1l' });
  player.stop(session.id);
});
it('sends no device state for a session with a phone', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const player = new ScriptPlayer({ script, clock: systemClock, onKiosk: () => undefined, onBarcode: () => undefined, onCode: () => undefined });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(3500);
  expect(session.state.cameraOn).toBe(false);
  expect(session.state.prompt).toMatchObject({ productId: 'oat-drink-1l' });
  player.stop(session.id);
});
it('a second start for the same session does nothing', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const dispatch = vi.spyOn(session, 'dispatch');
  const player = new ScriptPlayer({ script, clock: systemClock, onKiosk: () => undefined, onBarcode: () => undefined, onCode: () => undefined });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(2000);
  player.start(session, { fakeDevice: true });   // a new start would send the device state and play from 0 again
  await vi.advanceTimersByTimeAsync(1500);
  expect(session.state.cameraOn).toBe(false);
  expect(session.state.prompt).toMatchObject({ productId: 'oat-drink-1l' });
  expect(dispatch).toHaveBeenCalledTimes(3500 / TIMING.uploadEveryMs);
  player.stop(session.id);
});
it('reports the kiosk of a kiosk step one time each second', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const kioskScript: FakeScript = { loop: false, lengthMs: 10000, label: null, steps: [{ atMs: 1000, forMs: 3000, kiosk: 'K3X7' }] };
  const onKiosk = vi.fn();
  const player = new ScriptPlayer({ script: kioskScript, clock: systemClock, onKiosk, onBarcode: () => undefined, onCode: () => undefined });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(6000);
  expect(onKiosk.mock.calls).toEqual([[session, 'K3X7'], [session, 'K3X7'], [session, 'K3X7']]);
  player.stop(session.id);
});
it('stops when the session stops, and after stop', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const dispatch = vi.spyOn(session, 'dispatch');
  const player = new ScriptPlayer({ script, clock: systemClock, onKiosk: () => undefined, onBarcode: () => undefined, onCode: () => undefined });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(1000);
  session.stop();
  const calls = dispatch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(2000);
  expect(dispatch).toHaveBeenCalledTimes(calls);

  const next = await oneSession();
  const nextDispatch = vi.spyOn(next, 'dispatch');
  player.start(next, { fakeDevice: false });
  player.stop(next.id);
  await vi.advanceTimersByTimeAsync(2000);
  expect(nextDispatch).not.toHaveBeenCalled();
});
it('a fake server speaks to a browser client with no key', async () => {
  const { sessionId, token } = await fakeApp([oatStep]);
  const events = eventReader(await fetch(`${t!.base}/api/sessions/${sessionId}/events?token=${token}`, { signal: abort!.signal }));
  const seen: string[] = [];
  while (!seen.includes('glance.pending')) seen.push((await events.next() as ServerEvent).type);
  expect(seen).toContain('session.state');
  expect(seen).toContain('caption');
});
it('a fake server plays the script to a phone and sends no device state for it', async () => {
  const { sessionId, token } = await fakeApp([oatStep]);
  const phone = await connectPhone(t!, sessionId, token);
  expect(await phone.next((m) => m.t === 'speak')).toMatchObject({
    text: 'Oat drink, one litre, one eighty-nine. Nod to add.', url: null, promptId: 'p-0001',
  });
  expect((await t!.app.sessions.get(sessionId))!.state.cameraOn).toBe(false);
  phone.close();
});
it('a fake server logs the header of a frame and drops the frame', async () => {
  const lines: string[] = [];
  t = await testApp(
    { FAKE_RECOGNITION: tempScript({ loop: false, lengthMs: 1000, steps: [] }), GEMINI_API_KEY: '' },
    { log: { level: 'info', stream: { write: (line: string) => { lines.push(line); } } } },
  );
  const created = await (await fetch(`${t.base}/api/sessions`, { method: 'POST' })).json();
  const { sessionId, token } = CreateSessionResponseSchema.parse(created);
  const phone = await connectPhone(t, sessionId, token);
  phone.sendFrame({ seq: 7, ts: 1, w: 576, h: 768, blurred: false }, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  await vi.waitFor(() => expect(lines.join('')).toContain('frame seq=7 w=576 h=768 blurred=false kind=frame bytes=4'));
  phone.close();
});
it('a script with an unknown product stops the app at its start', async () => {
  const path = tempScript({ loop: true, lengthMs: 1000, steps: [
    { atMs: 0, forMs: 100, result: { status: 'identified', productId: 'nope' } },
  ] });
  await expect(testApp({ FAKE_RECOGNITION: path, GEMINI_API_KEY: '' })).rejects.toThrow(/step 1.*nope/);
});
it('reads a barcode step, the code of a result step, and the answer of the fake label reader', () => {
  const label = { digits: ['8076800195057'], brand: 'Barilla', name: 'Spaghetti n.5', packSize: '500 g', confidence: 0.9 };
  const path = tempScript({ loop: false, lengthMs: 9000, label, steps: [
    { atMs: 0, forMs: 1000, barcode: '80177173' },
    { atMs: 1000, forMs: 1000, result: { code: { visible: true, digits: null } } },
    { atMs: 2000, forMs: 1000, result: { status: 'unknown', code: { visible: true, digits: '3017624010701' } } },
  ] });
  const read = readFakeScript(path, catalog);
  expect(read.label).toEqual({ ...label, item: null, itemConfidence: 0 });
  expect(scriptAt(read, 0)).toEqual({ result: NO_RESULT, kiosk: null, barcode: '80177173' });
  expect(scriptAt(read, 1000).result).toEqual({ ...NO_RESULT, confidence: 0.95, code: { visible: true, digits: null } });
  expect(scriptAt(read, 2000).result).toMatchObject({ status: 'unknown', code: { visible: true, digits: '3017624010701' } });
});
it('rejects a barcode step with a code that is no code, a bad code in a result, and a bad label answer', () => {
  const steps = (step: unknown) => tempScript({ loop: false, lengthMs: 1000, steps: [step] });
  expect(() => readFakeScript(steps({ atMs: 0, forMs: 100, barcode: '80768-0019' }), catalog)).toThrow(/step 1.*result, kiosk, and barcode/);
  expect(() => readFakeScript(steps({ atMs: 0, forMs: 100, barcode: '8076800195057', kiosk: 'newest' }), catalog)).toThrow(/step 1/);
  expect(() => readFakeScript(steps({ atMs: 0, forMs: 100, result: { code: { visible: true } } }), catalog)).toThrow(/step 1/);
  const badLabel = tempScript({ loop: false, lengthMs: 1000, label: { digits: '8076800195057' }, steps: [] });
  expect(() => readFakeScript(badLabel, catalog)).toThrow(/label/);
});
it('reports the code of a barcode step one time each second, as the phone does', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const codeScript: FakeScript = { loop: false, lengthMs: 10000, label: null, steps: [{ atMs: 1000, forMs: 3000, barcode: '8076800195057' }] };
  const onBarcode = vi.fn();
  const player = new ScriptPlayer({ script: codeScript, clock: systemClock, onKiosk: () => undefined, onBarcode, onCode: () => undefined });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(6000);
  expect(onBarcode.mock.calls).toEqual([[session, '8076800195057'], [session, '8076800195057'], [session, '8076800195057']]);
  player.stop(session.id);
});
it('gives the digits of a result to the lookup with each result', async () => {
  vi.useFakeTimers();
  const session = await oneSession();
  const codeScript: FakeScript = { loop: false, lengthMs: 10000, label: null, steps: [
    { atMs: 0, forMs: 1000, result: { code: { visible: true, digits: null } } },
    { atMs: 1000, forMs: 1000, result: { code: { visible: true, digits: '3017624010701' } } },
  ] };
  const onCode = vi.fn();
  const player = new ScriptPlayer({ script: codeScript, clock: systemClock, onKiosk: () => undefined, onBarcode: () => undefined, onCode });
  player.start(session, { fakeDevice: false });
  await vi.advanceTimersByTimeAsync(3000);
  expect(onCode.mock.calls).toEqual([[session, '3017624010701'], [session, '3017624010701']]);
  player.stop(session.id);
});
it('a script can name a store item by the ID of a scanned product', async () => {
  const { sessionId, token } = await fakeApp([{ atMs: 0, forMs: 5000, result: { status: 'identified', productId: 'gtin-3017624010701' } }]);
  const phone = await connectPhone(t!, sessionId, token);
  const pending = await phone.next((m) => m.t === 'event' && m.event.type === 'glance.pending');
  expect(pending).toMatchObject({ event: { product: { id: 'gtin-3017624010701', name: 'Nutella', priceCents: 399 } } });
  phone.close();
});
