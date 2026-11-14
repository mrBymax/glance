import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Lang } from '@glance/shared';
import { MemoryStore } from '../db/memory';
import { ClipCache, clipKey } from './clips';
import { ELEVENLABS_MODEL, type FetchFn, type Synthesize, createSynthesize } from './elevenlabs';
import { createClipUrl } from './service';

// No test of this file reaches ElevenLabs. Each call goes to a function of the test.

let dir: string;
let store: MemoryStore;
let cache: ClipCache;
let synthesize: ReturnType<typeof vi.fn<Synthesize>>;
let logs: string[];
let clipUrl: (text: string, lang: Lang) => Promise<string | null>;
let fakeClipUrl: (text: string, lang: Lang) => Promise<string | null>;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'glance-clips-'));
  store = new MemoryStore();
  // The cache makes its directory, so the test gives it one that does not exist yet.
  cache = new ClipCache(join(dir, 'speech'), store);
  synthesize = vi.fn<Synthesize>(async () => new Uint8Array([1, 2, 3]));
  logs = [];
  const deps = {
    cache, synthesize, voiceId: { en: 'voice-en', it: null }, publicBaseUrl: 'http://localhost:8080',
    log: (line: string) => { logs.push(line); },
  };
  clipUrl = createClipUrl({ ...deps, fake: false });
  fakeClipUrl = createClipUrl({ ...deps, fake: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('makes a stable key from text, language, voice, and model', () => {
  const key = clipKey('Skipped.', 'en', 'v1', ELEVENLABS_MODEL);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  expect(clipKey('Skipped.', 'en', 'v1', ELEVENLABS_MODEL)).toBe(key);
  const others = [clipKey('Skipped', 'en', 'v1', ELEVENLABS_MODEL), clipKey('Skipped.', 'it', 'v1', ELEVENLABS_MODEL),
    clipKey('Skipped.', 'en', 'v2', ELEVENLABS_MODEL), clipKey('Skipped.', 'en', 'v1', 'other-model')];
  for (const other of others) expect(other).not.toBe(key);
});
it('keeps two keys apart when a part of one value moves to the next value', () => {
  expect(clipKey('a', 'en', 'bc', 'm')).not.toBe(clipKey('a', 'en', 'b', 'cm'));
});
it('sends the request of the vendor docs', async () => {
  const fetchFn = vi.fn<FetchFn>(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const mp3 = await createSynthesize('key-1', fetchFn)('Skipped.', 'voice-1');
  const [url, init] = fetchFn.mock.calls[0]!;
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1/stream?output_format=mp3_44100_128');
  expect(init).toMatchObject({ method: 'POST', headers: { 'xi-api-key': 'key-1', 'content-type': 'application/json' } });
  expect(JSON.parse(init.body as string)).toEqual({ text: 'Skipped.', model_id: 'eleven_flash_v2_5' });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(mp3).toEqual(new Uint8Array([1, 2, 3]));
});
it('throws with the status of a failed call, and not with the key', async () => {
  const fetchFn = vi.fn<FetchFn>(async () => new Response('quota', { status: 401 }));
  const error = await createSynthesize('key-1', fetchFn)('x', 'v').catch((e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toMatch(/401/);
  expect((error as Error).message).not.toContain('key-1');
});
it('throws for an answer with no audio', async () => {
  const fetchFn = vi.fn<FetchFn>(async () => new Response(new Uint8Array(), { status: 200 }));
  await expect(createSynthesize('k', fetchFn)('x', 'v')).rejects.toThrow(/no audio/);
});
it('writes a clip to its file and to the store', async () => {
  const hash = 'a'.repeat(64);
  expect(cache.has(hash)).toBe(false);
  await cache.put(hash, new Uint8Array([1, 2, 3]));
  expect(cache.has(hash)).toBe(true);
  expect(cache.path(hash)).toBe(join(dir, 'speech', `${hash}.mp3`));
  expect(new Uint8Array(readFileSync(cache.path(hash)))).toEqual(new Uint8Array([1, 2, 3]));
  expect(await store.getClip(hash)).toEqual({ _id: hash, path: cache.path(hash) });
  expect(readdirSync(join(dir, 'speech'))).toEqual([`${hash}.mp3`]);   // no temp file stays
});
it('makes a clip one time and then uses the cache', async () => {
  const url = await clipUrl('Skipped.', 'en');
  expect(url).toBe(`http://localhost:8080/api/speech/${clipKey('Skipped.', 'en', 'voice-en', ELEVENLABS_MODEL)}.mp3`);
  await clipUrl('Skipped.', 'en');
  expect(synthesize).toHaveBeenCalledTimes(1);
});
it('uses a clip that an earlier process put in the directory', async () => {
  await clipUrl('Skipped.', 'en');
  const later = createClipUrl({
    fake: false, cache: new ClipCache(join(dir, 'speech'), store), synthesize, voiceId: { en: 'voice-en', it: null },
    publicBaseUrl: 'http://localhost:8080',
  });
  expect(await later('Skipped.', 'en')).toMatch(/\.mp3$/);
  expect(synthesize).toHaveBeenCalledTimes(1);
});
it('shares one request between two calls at the same time', async () => {
  await Promise.all([clipUrl('Hold it up again.', 'en'), clipUrl('Hold it up again.', 'en')]);
  expect(synthesize).toHaveBeenCalledTimes(1);
});
it('uses the English voice when the language has none', async () => {
  await clipUrl('Saltato.', 'it');
  expect(synthesize).toHaveBeenCalledWith('Saltato.', 'voice-en');
});
it('uses the voice of the language when it has one', async () => {
  const both = createClipUrl({
    fake: false, cache, synthesize, voiceId: { en: 'voice-en', it: 'voice-it' }, publicBaseUrl: 'http://localhost:8080',
  });
  await both('Saltato.', 'it');
  expect(synthesize).toHaveBeenCalledWith('Saltato.', 'voice-it');
});
it('makes no call with FAKE_SPEECH', async () => {
  expect(await fakeClipUrl('Skipped.', 'en')).toBeNull();
  expect(synthesize).not.toHaveBeenCalled();
});
it('makes no clip with no synthesize function or with no voice', async () => {
  const base = { fake: false, cache, publicBaseUrl: 'http://localhost:8080' };
  expect(await createClipUrl({ ...base, synthesize: null, voiceId: { en: 'voice-en', it: null } })('Skipped.', 'en')).toBeNull();
  expect(await createClipUrl({ ...base, synthesize, voiceId: { en: null, it: null } })('Skipped.', 'en')).toBeNull();
  expect(synthesize).not.toHaveBeenCalled();
});
it('returns null when the call fails, and tries again the next time', async () => {
  synthesize.mockRejectedValueOnce(new Error('ElevenLabs answered 503'));
  expect(await clipUrl('Camera off.', 'en')).toBeNull();
  expect(logs).toEqual(['speech: no clip. ElevenLabs answered 503']);
  expect(await clipUrl('Camera off.', 'en')).toMatch(/\.mp3$/);
});
it('returns null when the cache cannot write, and keeps no file', async () => {
  vi.spyOn(store, 'putClip').mockRejectedValueOnce(new Error('store down'));
  expect(await clipUrl('Camera off.', 'en')).toBeNull();
  expect(existsSync(cache.path(clipKey('Camera off.', 'en', 'voice-en', ELEVENLABS_MODEL)))).toBe(false);
});
it('builds the address from a base that ends with a slash, and from a function', async () => {
  const base = { fake: false, cache, synthesize, voiceId: { en: 'voice-en', it: null } };
  expect(await createClipUrl({ ...base, publicBaseUrl: 'https://glance.example/' })('Skipped.', 'en'))
    .toMatch(/^https:\/\/glance\.example\/api\/speech\/[0-9a-f]{64}\.mp3$/);
  expect(await createClipUrl({ ...base, publicBaseUrl: () => 'http://127.0.0.1:9' })('Skipped.', 'en'))
    .toMatch(/^http:\/\/127\.0\.0\.1:9\/api\/speech\//);
});
