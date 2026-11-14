// Test helpers. No product code imports this file.
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { type DeviceToServer, type FrameHeader, type ServerToDevice, encodeFrame, parseServerToDevice } from '@glance/shared';
import { type AppDeps, buildApp } from './app';
import { indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { loadConfig } from './config';
import { MemoryStore } from './db/memory';
import { createFakeProductInfo } from './products/fakeProductInfo';
import { readStoreListFile } from './products/storeList';

const DEV_CATALOG = fileURLToPath(new URL('../catalog/catalog.dev.json', import.meta.url));
const DEV_STORE_LIST = fileURLToPath(new URL('../catalog/store-list.dev.json', import.meta.url));
const PRODUCT_FIXTURES = fileURLToPath(new URL('../fixtures/product-info', import.meta.url));

export type TestApp = { app: FastifyInstance; base: string; wsBase: string; store: MemoryStore; close(): Promise<void> };

/**
 * Starts the app on a free port of 127.0.0.1, with a memory store, the dev catalog, the dev store list,
 * and the product details of the fixtures, so no test calls Open Food Facts.
 * The config has fake speech, a payment of 10 ms, and a speech cache in a new temp directory that close() removes. `env` changes it, and `over` replaces dependencies of the app.
 */
export async function testApp(env: Record<string, string> = {}, over: Partial<AppDeps> = {}): Promise<TestApp> {
  const products = readCatalogFile(DEV_CATALOG);
  const store = new MemoryStore(products);
  const cacheDir = mkdtempSync(join(tmpdir(), 'glance-speech-'));
  const removeCacheDir = (): void => rmSync(cacheDir, { recursive: true, force: true });
  let app: FastifyInstance;
  try {
    const config = loadConfig({
      FAKE_SPEECH: '1', FAKE_PRODUCT_INFO: '1', GEMINI_API_KEY: 'test', PAYMENT_DELAY_MS: '10', SPEECH_CACHE_DIR: cacheDir, ...env,
    }, []);
    app = await buildApp({
      config, clock: systemClock, store, catalog: indexCatalog(products), log: false,
      storeList: readStoreListFile(DEV_STORE_LIST), productInfo: createFakeProductInfo(PRODUCT_FIXTURES), ...over,
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    // The port is known only now, and the session answer builds the socket address from this value.
    if (env.PUBLIC_BASE_URL === undefined) config.publicBaseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  } catch (error) {
    removeCacheDir();
    throw error;
  }

  const { port } = app.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const close = async (): Promise<void> => {
    await app.close();
    removeCacheDir();
  };
  return { app, base, wsBase: `ws://127.0.0.1:${port}`, store, close };
}

/** Reads the events stream of a fetch response. `next` gives the JSON of the next `data:` message. */
export function eventReader(response: Response): { next(): Promise<unknown> } {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    async next() {
      for (;;) {
        const end = buffer.indexOf('\n\n');
        if (end >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart());
          // A block with no data line is a comment, for example the ping.
          if (data.length > 0) return JSON.parse(data.join('\n'));
          continue;
        }
        const chunk = await reader.read();
        if (chunk.done) throw new Error('The events stream ended.');
        buffer += decoder.decode(chunk.value, { stream: true });
      }
    },
  };
}

/** A phone on the device socket of a test app. */
export type TestPhone = {
  /** Each message of the server, oldest first. */
  messages: ServerToDevice[];
  send(message: DeviceToServer): void;
  /** For a test of bad input. */
  sendRaw(data: string | Uint8Array): void;
  sendFrame(header: FrameHeader, jpeg: Uint8Array): void;
  /** The first message that matches. It also matches a message that came before the call. */
  next(match: (message: ServerToDevice) => boolean): Promise<ServerToDevice>;
  /** Resolves when the socket has closed. */
  closed: Promise<void>;
  close(): void;
};

/** Opens the device socket of a session. Rejects when the server refuses the upgrade. */
export function connectPhone(t: TestApp, sessionId: string, token: string): Promise<TestPhone> {
  const ws = new WebSocket(`${t.wsBase}/ws/device?session=${sessionId}&token=${token}`);
  const messages: ServerToDevice[] = [];
  const waiting: { match: (message: ServerToDevice) => boolean; resolve: (message: ServerToDevice) => void }[] = [];

  ws.on('message', (data, isBinary) => {
    const message = isBinary ? null : parseServerToDevice(JSON.parse(data.toString()));
    // A message outside the contract is a bug of the server, so the test must see it.
    if (!message) throw new Error(`The server sent a message that is no ServerToDevice: ${data.toString()}`);
    messages.push(message);
    for (const waiter of waiting.filter((entry) => entry.match(message))) {
      waiting.splice(waiting.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });

  const phone: TestPhone = {
    messages,
    send: (message) => ws.send(JSON.stringify(message)),
    sendRaw: (data) => ws.send(data),
    sendFrame: (header, jpeg) => ws.send(encodeFrame(header, jpeg)),
    next: (match) => {
      const found = messages.find(match);
      if (found) return Promise.resolve(found);
      return new Promise((resolve) => waiting.push({ match, resolve }));
    },
    closed: new Promise((resolve) => ws.once('close', () => resolve())),
    close: () => ws.close(),
  };
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(phone));
    ws.once('error', reject);
  });
}

/** The HTTP status of a refused socket upgrade. Rejects when the server accepts the upgrade. */
export function upgradeStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('unexpected-response', (request, response) => {
      request.destroy();
      resolve(response.statusCode ?? 0);
    });
    ws.once('open', () => {
      ws.close();
      reject(new Error(`The server accepted the upgrade for ${url}.`));
    });
    ws.once('error', reject);
  });
}
