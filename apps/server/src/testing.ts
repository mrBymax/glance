// Test helpers. No product code imports this file.
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { type AppDeps, buildApp } from './app';
import { indexCatalog, readCatalogFile } from './catalog/catalog';
import { systemClock } from './clock';
import { loadConfig } from './config';
import { MemoryStore } from './db/memory';

const DEV_CATALOG = fileURLToPath(new URL('../catalog/catalog.dev.json', import.meta.url));

export type TestApp = { app: FastifyInstance; base: string; wsBase: string; store: MemoryStore; close(): Promise<void> };

/**
 * Starts the app on a free port of 127.0.0.1, with a memory store and the dev catalog.
 * The config has fake speech and a payment of 10 ms. `env` changes it, and `over` replaces dependencies of the app.
 */
export async function testApp(env: Record<string, string> = {}, over: Partial<AppDeps> = {}): Promise<TestApp> {
  const products = readCatalogFile(DEV_CATALOG);
  const store = new MemoryStore(products);
  const config = loadConfig({ FAKE_SPEECH: '1', GEMINI_API_KEY: 'test', PAYMENT_DELAY_MS: '10', ...env }, []);
  const app = await buildApp({ config, clock: systemClock, store, catalog: indexCatalog(products), log: false, ...over });
  await app.listen({ host: '127.0.0.1', port: 0 });

  const { port } = app.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  // The port is known only now, and the session answer builds the socket address from this value.
  if (env.PUBLIC_BASE_URL === undefined) config.publicBaseUrl = base;
  return { app, base, wsBase: `ws://127.0.0.1:${port}`, store, close: () => app.close() };
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
