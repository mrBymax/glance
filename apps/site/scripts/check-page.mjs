// Checks the built page in headless Chrome: axe (WCAG 2.2 A and AA), the contrast of each text, target sizes, sideways
// scroll, the heading outline, the order of keyboard focus, and the load (bytes, requests, LCP, CLS).
// It needs a served build (npm run build, then npm run preview) and a local Chrome. CHROME_PATH names Chrome.
//   node scripts/check-page.mjs [page URL]
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const url = process.argv[2] ?? 'http://localhost:18421/';
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const VIEWPORTS = [[360, 800], [768, 1024], [1440, 900], [1920, 1080]];
const SCHEMES = ['light', 'dark'];

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`FAIL ${message}`);
};

async function openPage(width, height, scheme, reducedMotion = 'no-preference') {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reducedMotion },
  ]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  return page;
}

// 1. The load, measured on a cold cache, with the animation allowed. SwiftShader slows the first paint by seconds, so
// this part runs in a Chrome with its default flags.
{
  const plain = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await plain.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  const requests = new Map();
  client.on('Network.responseReceived', ({ requestId, response }) => requests.set(requestId, { url: response.url, bytes: 0 }));
  client.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const request = requests.get(requestId);
    if (request) request.bytes = encodedDataLength;
  });
  await page.evaluateOnNewDocument(() => {
    window.__vitals = { lcp: null, lcpElement: null, cls: 0 };
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      window.__vitals.lcp = last.startTime;
      window.__vitals.lcpElement = last.element ? `${last.element.tagName.toLowerCase()}.${last.element.className}` : String(last.url);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'load' });
  const atLoad = [...requests.values()];
  const loadBytes = atLoad.reduce((sum, request) => sum + request.bytes, 0);
  await new Promise((resolve) => setTimeout(resolve, 10000));
  const all = [...requests.values()];
  const allBytes = all.reduce((sum, request) => sum + request.bytes, 0);
  const vitals = await page.evaluate(() => window.__vitals);
  // GLTFLoader turns the textures inside the GLB into blob URLs of the page.
  const remote = all.filter((request) => !/^(data|blob):/.test(request.url) && !request.url.startsWith(new URL(url).origin));
  console.log(`load: ${atLoad.length} requests, ${(loadBytes / 1024).toFixed(0)} KB transferred at the load event`);
  console.log(`after 10 s: ${all.length} requests, ${(allBytes / 1024).toFixed(0)} KB transferred, with the animation`);
  for (const request of all.sort((a, b) => b.bytes - a.bytes).slice(0, 5)) console.log(`  ${(request.bytes / 1024).toFixed(0)} KB ${request.url.replace(/.*\//, '')}`);
  console.log(`LCP ${vitals.lcp?.toFixed(0)} ms on ${vitals.lcpElement}, CLS ${vitals.cls.toFixed(4)}`);
  if (remote.length > 0) fail(`remote requests: ${remote.map((request) => request.url).join(', ')}`);
  if (vitals.cls > 0.1) fail(`CLS ${vitals.cls}`);
  await plain.close();
}

// 2. axe, targets, sideways scroll, and contrast at each viewport and color scheme.
for (const scheme of SCHEMES) {
  for (const [width, height] of VIEWPORTS) {
    const page = await openPage(width, height, scheme);
    const tag = `${width}x${height} ${scheme}`;
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
      return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes, first ${v.nodes[0]?.target.join(' ')}`);
    });
    for (const violation of axe) fail(`${tag} axe ${violation}`);
    const layout = await page.evaluate(() => {
      const small = [];
      for (const element of document.querySelectorAll('a[href], button, summary, [role="button"]')) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        // WCAG 2.5.8 exempts a link inside a sentence.
        if (element.tagName === 'A' && element.closest('p')) continue;
        if (box.width < 24 || box.height < 24) small.push(`${element.tagName.toLowerCase()} "${element.textContent?.trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
      return { small, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    for (const target of layout.small) fail(`${tag} target under 24 px: ${target}`);
    if (layout.sideways) fail(`${tag} the page scrolls sideways`);
    console.log(`${tag}: axe ${axe.length} violations, ${layout.small.length} small targets`);
    await page.close();
  }
}

// 3. The heading outline, the landmarks, and the order of keyboard focus, at 1440 x 900.
{
  const page = await openPage(1440, 900, 'light', 'reduce');
  const outline = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].map((h) => `${h.tagName} ${h.textContent.trim()}`));
  console.log('headings:');
  for (const line of outline) console.log(`  ${line}`);
  const levels = outline.map((line) => Number(line[1]));
  levels.forEach((level, index) => {
    if (index > 0 && level > levels[index - 1] + 1) fail(`heading level jumps before "${outline[index]}"`);
  });
  const landmarks = await page.evaluate(() => [...document.querySelectorAll('header, nav, main, footer, [role="region"], section[aria-labelledby]')].map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('aria-label') ? ` "${e.getAttribute('aria-label')}"` : ''}`));
  console.log(`landmarks: ${[...new Set(landmarks)].join(', ')}`);

  const stops = [];
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const ring = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
      const shadow = style.boxShadow !== 'none';
      // WCAG 2.4.11: the focused element must not be hidden by the sticky header. The element at its center tells.
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const hidden = top !== null && !element.contains(top) && !top.contains(element) && top.closest('.site-header') !== null;
      return { label: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`, visibleRing: ring || shadow, hidden };
    });
    if (!stop) break;
    stops.push(stop);
    if (!stop.visibleRing) fail(`focus ring not visible on ${stop.label}`);
    if (stop.hidden) fail(`focus hidden under the sticky header on ${stop.label}`);
  }
  console.log(`keyboard: ${stops.length} focus stops in the first 60 presses of Tab; first ${stops.slice(0, 4).map((s) => s.label).join(', ')}`);
  await page.close();
}

await browser.close();
console.log(failures === 0 ? 'OK' : `${failures} problems`);
process.exitCode = failures === 0 ? 0 : 1;
