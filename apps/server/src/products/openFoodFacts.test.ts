import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import type { FetchFn } from '../speech/elevenlabs';
import { FAKE_PRODUCT_INFO_DIR } from './fakeProductInfo';
import {
  DEFAULT_OFF_BASE_URL, DEFAULT_PRODUCT_INFO_USER_AGENT, OFF_HIT_TTL_MS, OFF_MISS_TTL_MS,
  OFF_PAUSE_AFTER_429_MS, OFF_RETRY_AFTER_MS, OFF_TIMEOUT_MS, createOpenFoodFactsInfo,
} from './openFoodFacts';

// No test of this file reaches Open Food Facts. Each reader gets a fetch function of the test.

const SPAGHETTI = '8076800195057';
const spaghettiBody = readFileSync(`${FAKE_PRODUCT_INFO_DIR}/${SPAGHETTI}.json`, 'utf8');
const json = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json' } });
const NOT_FOUND = '{"code":"4006381333931","status":0,"status_verbose":"product not found"}';

const root = mkdtempSync(join(tmpdir(), 'glance-products-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

let cacheDir: string;
let now: number;
let fetchStub: ReturnType<typeof vi.fn<FetchFn>>;
let logLines: string[];

beforeEach(() => {
  cacheDir = mkdtempSync(join(root, 'cache-'));
  now = 1_000_000;
  fetchStub = vi.fn<FetchFn>(async () => json(spaghettiBody));
  logLines = [];
});

function reader(over: { baseUrl?: string; userAgent?: string } = {}) {
  return createOpenFoodFactsInfo({
    baseUrl: over.baseUrl ?? DEFAULT_OFF_BASE_URL, userAgent: over.userAgent ?? DEFAULT_PRODUCT_INFO_USER_AGENT,
    cacheDir, fetch: fetchStub, clock: { now: () => now }, log: (line) => { logLines.push(line); },
  });
}

it('asks for one product with the fields that it reads, and names the app', async () => {
  expect(await reader().byGtin(SPAGHETTI)).toMatchObject({ name: { it: 'Spaghetti n.5' }, brand: 'Barilla' });
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const [url, init] = fetchStub.mock.calls[0]!;
  expect(url).toBe(
    'https://world.openfoodfacts.org/api/v2/product/8076800195057'
    + '?fields=code,product_name,product_name_en,product_name_it,brands,quantity,allergens_tags,traces_tags,ingredients_analysis_tags',
  );
  expect(new Headers(init.headers).get('user-agent')).toBe('MetaGlance/0.1 (https://github.com/mrBymax/glance)');
  expect(init.signal).toBeInstanceOf(AbortSignal);
});
it('uses the base address and the User-Agent of the settings', async () => {
  await reader({ baseUrl: 'https://world.openfoodfacts.net/', userAgent: 'Shop/2 (shop@example.com)' }).byGtin(SPAGHETTI);
  const [url, init] = fetchStub.mock.calls[0]!;
  expect(url).toMatch(/^https:\/\/world\.openfoodfacts\.net\/api\/v2\/product\/8076800195057\?/);
  expect(new Headers(init.headers).get('user-agent')).toBe('Shop/2 (shop@example.com)');
});
it('asks for a short code as the database stores it', async () => {
  await reader().byGtin('0000080177173');
  await reader().byGtin('0036000291452');
  expect(fetchStub.mock.calls.map(([url]) => url.split('?')[0]!.split('/').at(-1))).toEqual(['80177173', '0036000291452']);
});
it('reads the status 404, and the status 0 in a body, as not found', async () => {
  fetchStub.mockImplementation(async () => json(NOT_FOUND, 404));
  expect(await reader().byGtin('4006381333931')).toBeNull();
  fetchStub.mockImplementation(async () => new Response('<html>Not found</html>', { status: 404 }));
  expect(await reader().byGtin('4006381333948')).toBeNull();
  fetchStub.mockImplementation(async () => json(NOT_FOUND));
  expect(await reader().byGtin('4006381333955')).toBeNull();
});
it('rejects for each other status, for a body that is no JSON, and for a network error', async () => {
  fetchStub.mockImplementation(async () => new Response('busy', { status: 503 }));
  await expect(reader().byGtin(SPAGHETTI)).rejects.toThrow(/Open Food Facts answered 503/);
  fetchStub.mockImplementation(async () => new Response('<html>', { status: 200 }));
  await expect(reader().byGtin(SPAGHETTI)).rejects.toThrow(/no JSON/);
  fetchStub.mockImplementation(async () => { throw new TypeError('fetch failed'); });
  await expect(reader().byGtin(SPAGHETTI)).rejects.toThrow(/fetch failed/);
  expect(readdirSync(cacheDir)).toEqual([]);
});
it('ends a call after 2 seconds', async () => {
  expect(OFF_TIMEOUT_MS).toBe(2000);
  // As the real fetch does: the call never answers, and it rejects when its signal aborts.
  fetchStub.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(new DOMException('The call timed out.', 'TimeoutError')));
  }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    const call = reader().byGtin(SPAGHETTI);
    const failed = expect(call).rejects.toThrow(/timed out/);
    // The reader looks for a cache file first, so the request starts a moment later.
    while (fetchStub.mock.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(OFF_TIMEOUT_MS - 1);
    expect(fetchStub.mock.calls[0]![1].signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await failed;
  } finally {
    vi.useRealTimers();
  }
});
it('keeps a hit for 30 days in memory', async () => {
  const info = reader();
  await info.byGtin(SPAGHETTI);
  now += OFF_HIT_TTL_MS - 1;
  expect(await info.byGtin(SPAGHETTI)).toMatchObject({ brand: 'Barilla' });
  expect(fetchStub).toHaveBeenCalledTimes(1);
  now += 1;
  await info.byGtin(SPAGHETTI);
  expect(fetchStub).toHaveBeenCalledTimes(2);
});
it('keeps a miss for 1 day', async () => {
  fetchStub.mockImplementation(async () => json(NOT_FOUND, 404));
  const info = reader();
  expect(await info.byGtin('4006381333931')).toBeNull();
  now += OFF_MISS_TTL_MS - 1;
  expect(await info.byGtin('4006381333931')).toBeNull();
  expect(fetchStub).toHaveBeenCalledTimes(1);
  now += 1;
  await info.byGtin('4006381333931');
  expect(fetchStub).toHaveBeenCalledTimes(2);
});
it('keeps each answer as a file, so a new process makes no call', async () => {
  const hit = await reader().byGtin(SPAGHETTI);
  fetchStub.mockImplementation(async () => json(NOT_FOUND, 404));
  await reader().byGtin('4006381333931');
  expect(readdirSync(cacheDir).sort()).toEqual(['4006381333931.json', '8076800195057.json']);
  fetchStub.mockClear();

  const next = reader();
  expect(await next.byGtin(SPAGHETTI)).toEqual(hit);
  expect(await next.byGtin('4006381333931')).toBeNull();
  expect(fetchStub).not.toHaveBeenCalled();

  now += OFF_MISS_TTL_MS;
  await reader().byGtin('4006381333931');
  expect(fetchStub).toHaveBeenCalledTimes(1);
});
it('reads again when a cache file is broken', async () => {
  writeFileSync(join(cacheDir, `${SPAGHETTI}.json`), '{"fetchedAt":');
  expect(await reader().byGtin(SPAGHETTI)).toMatchObject({ brand: 'Barilla' });
  expect(fetchStub).toHaveBeenCalledTimes(1);
});
it('still answers when the cache file cannot be written', async () => {
  // A file where the cache directory must be.
  cacheDir = join(cacheDir, 'taken');
  writeFileSync(cacheDir, '');
  expect(await reader().byGtin(SPAGHETTI)).toMatchObject({ brand: 'Barilla' });
  expect(logLines.join('\n')).toMatch(/product info: cache file not written/);
});
it('shares one request between the calls for one code that run together', async () => {
  let answer!: (response: Response) => void;
  fetchStub.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
  const info = reader();
  const calls = [info.byGtin(SPAGHETTI), info.byGtin(SPAGHETTI), info.byGtin(SPAGHETTI)];
  await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
  answer(json(spaghettiBody));
  const results = await Promise.all(calls);
  expect(results[1]).toEqual(results[0]);
  expect(results[2]).toMatchObject({ brand: 'Barilla' });
  expect(fetchStub).toHaveBeenCalledTimes(1);
});
it('after a failed request, waits 30 seconds before the next request for that code', async () => {
  expect(OFF_RETRY_AFTER_MS).toBe(30_000);
  fetchStub.mockImplementationOnce(async () => new Response('busy', { status: 503 }));
  const info = reader();
  await expect(info.byGtin(SPAGHETTI)).rejects.toThrow(/503/);
  now += OFF_RETRY_AFTER_MS - 1;
  await expect(info.byGtin(SPAGHETTI)).rejects.toThrow(/failed 30 s ago/);
  expect(fetchStub).toHaveBeenCalledTimes(1);
  // Another code has no wait.
  expect(await info.byGtin('3017624010701')).not.toBeNull();
  now += 1;
  expect(await info.byGtin(SPAGHETTI)).toMatchObject({ brand: 'Barilla' });
  expect(fetchStub).toHaveBeenCalledTimes(3);
});
it('after the status 429, makes no request for each code for 60 seconds', async () => {
  expect(OFF_PAUSE_AFTER_429_MS).toBe(60_000);
  fetchStub.mockImplementationOnce(async () => new Response('Too many requests', { status: 429 }));
  const info = reader();
  await expect(info.byGtin(SPAGHETTI)).rejects.toThrow(/429/);
  now += OFF_PAUSE_AFTER_429_MS - 1;
  await expect(info.byGtin('3017624010701')).rejects.toThrow(/allows no call/);
  expect(fetchStub).toHaveBeenCalledTimes(1);
  now += 1;
  expect(await info.byGtin('3017624010701')).not.toBeNull();
  expect(fetchStub).toHaveBeenCalledTimes(2);
});
it('a body with the status 200 and no product is a failed read, and not a miss', async () => {
  for (const body of ['{"error":"busy"}', '{"status":1}', '[]', '"ok"']) {
    fetchStub.mockImplementation(async () => json(body));
    await expect(reader().byGtin(SPAGHETTI)).rejects.toThrow(/no product/);
  }
  expect(readdirSync(cacheDir)).toEqual([]);
});
it('never asks for a code that only one store can know', async () => {
  const info = reader();
  for (const gtin of ['2000000000015', '0212345678906', '0412345678904']) expect(await info.byGtin(gtin)).toBeNull();
  expect(fetchStub).not.toHaveBeenCalled();
  expect(existsSync(join(cacheDir, '2000000000015.json'))).toBe(false);
});
