// Serves the web apps with their Vite dev servers and opens them in the installed Chrome, for the integration tests.
import { Agent } from 'node:http';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { freePort, repoRoot } from './server.mjs';

const HOST = '127.0.0.1';
const WAIT_MS = 30_000;
/**
 * The wait of a test checks the page at this interval. The default of Puppeteer checks at each animation frame,
 * and Chrome gives no animation frame to a page that is not the front page of the browser.
 */
export const POLL_MS = 100;

/**
 * Starts the Vite dev server of one app on a free port of 127.0.0.1, with the config file of the app.
 * `apiOrigin` is the target of its /api proxy. Returns the address and `stop`.
 * The proxy rule of the config file gets an agent here. With no agent, the proxy of Vite 8.3.8 on Node 26.12.1 and Windows
 * lost about one call in four with ECONNRESET, also with a plain Node server as its target. With an agent it lost none.
 */
export async function startDevServer(appDir, apiOrigin) {
  const root = resolve(repoRoot, appDir);
  const port = await freePort();
  // The config file of each app reads this variable for its proxy when the server starts.
  process.env.GLANCE_SERVER_ORIGIN = apiOrigin;
  const agent = new Agent();
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    server: { host: HOST, port, strictPort: true, proxy: { '/api': { agent } } },
  });
  await server.listen();
  const stop = async () => {
    await server.close();
    agent.destroy();
  };
  return { url: `http://${HOST}:${port}`, stop };
}

/**
 * Starts the installed Chrome with no window. puppeteer-core downloads no browser.
 * CHROME_PATH selects another browser file, for example Edge.
 */
export function startBrowser() {
  const path = process.env.CHROME_PATH;
  return puppeteer.launch(path ? { executablePath: path } : { channel: 'chrome' });
}

/**
 * Opens an address two times and waits for the h1 of the page.
 * With an empty cache, Vite can load the page again after the first load, when it has prepared the packages.
 * The second load starts with the packages ready, so the page keeps its state during the test.
 * Each error that the page throws goes to `problems`.
 */
export async function openPage(browser, name, url, viewport, problems) {
  const page = await browser.newPage();
  page.setDefaultTimeout(WAIT_MS);
  await page.setViewport(viewport);
  page.on('pageerror', (error) => problems.push(`${name}: the page threw "${error.message}".`));
  // The network of a page never gets idle: the event stream and the socket of Vite stay open.
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('h1');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('h1');
  return page;
}

/** Waits until an element of the selector holds the text. The error names the page and the text. */
export async function waitForText(page, name, selector, text) {
  try {
    await page.waitForFunction(
      (css, wanted) => [...document.querySelectorAll(css)].some((element) => element.textContent.includes(wanted)),
      { polling: POLL_MS },
      selector,
      text,
    );
  } catch (error) {
    const shown = await page.evaluate(() => document.body.innerText).catch(() => '(the page did not answer)');
    throw new Error(`${name}: no "${selector}" element shows "${text}". The page shows:\n${shown}`, { cause: error });
  }
}
