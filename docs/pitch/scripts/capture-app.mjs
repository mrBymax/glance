// Captures the real screens of the deck from the replay modes of the app branch (feat/barcode-lookup).
// No server and no vendor call: each page plays its recorded run.
//
// Start the three dev servers of the app checkout first, each on a free port:
//   apps/mobile/ui     npx vite --port 18431 --strictPort    (?replay=1&ready=1)
//   apps/website       npx vite --port 18432 --strictPort    (/kiosk?replay=1)
//   apps/display-pow   npx vite --port 18433 --strictPort    (the recorded HUD run)
// Then run:  node docs/pitch/scripts/capture-app.mjs
// PUPPETEER_FROM names a package.json next to a node_modules with puppeteer-core. CHROME_PATH names Chrome.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PUPPETEER_FROM ?? 'C:/Users/marco/Desktop/glance/scripts/integration/package.json');
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = process.env.PHONE_URL ?? 'http://localhost:18431';
const KIOSK = process.env.KIOSK_URL ?? 'http://localhost:18432';
const HUD = process.env.HUD_URL ?? 'http://localhost:18433';

const outDir = fileURLToPath(new URL('../assets/screens/', import.meta.url));
await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(url, viewport, scheme = 'light') {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'networkidle0' });
  return page;
}

/**
 * Takes one picture of each state of a recorded run. Each state is the moment its text shows on the page, plus a short
 * pause for the transition; the replays loop or run on timers, so a fixed time can land on the wrong state.
 */
async function run(url, viewport, shots, scheme) {
  const page = await open(url, viewport, scheme);
  for (const [text, name] of shots) {
    await page.waitForFunction((value) => document.body.innerText.includes(value), { timeout: 40000 }, text);
    await sleep(900);
    await page.screenshot({ path: `${outDir}${name}.png` });
  }
  return page;
}

const phone = { width: 390, height: 844, deviceScaleFactor: 3 };

// The recorded shop of the phone app (apps/mobile/ui/src/debug/demoRun.ts): start, product prompt, added, pay prompt, paid.
await (await run(`${PHONE}/?replay=1&ready=1`, phone, [
  ['Nod to add.', 'phone-prompt'],
  ['Added oat drink.', 'phone-added'],
  ['Checkout 3 at Demo Market', 'phone-checkout'],
  ['No money moved', 'phone-paid'],
])).close();

// The settings: the inputs of the head and the time to answer.
{
  const page = await open(`${PHONE}/?replay=1&ready=1`, phone);
  await sleep(1500);
  await page.click('button[aria-label="Settings"]');
  await sleep(1200);
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('*')].find((node) => node.childElementCount === 0 && node.textContent?.trim() === 'Input and feedback');
    heading?.scrollIntoView({ block: 'start' });
  });
  await sleep(600);
  await page.screenshot({ path: `${outDir}phone-settings-input.png` });
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('*')].find((node) => node.childElementCount === 0 && node.textContent?.trim() === 'Allergens');
    heading?.scrollIntoView({ block: 'start' });
  });
  await sleep(600);
  await page.screenshot({ path: `${outDir}phone-settings-allergens.png` });
  await page.close();
}

// The setup screen: the glasses link through the Meta AI app, then the camera and the notifications.
await (await run(`${PHONE}/`, phone, [['Link glasses', 'phone-setup']])).close();

// The kiosk page (apps/website/src/kiosk/kioskRun.ts): waiting for the nod, paid, then the idle code.
await (await run(`${KIOSK}/kiosk?replay=1`, { width: 1920, height: 1080, deviceScaleFactor: 1 }, [
  ['Waiting for your nod', 'kiosk-connected'],
  ['No money moved', 'kiosk-paid'],
  ['Look at this code to pay', 'kiosk-idle'],
])).close();

// The Display HUD mockup, on the 600 x 600 screen of Meta Ray-Ban Display.
await (await run(`${HUD}/`, { width: 600, height: 600, deviceScaleFactor: 2 }, [['Add to cart?', 'hud-prompt']], 'dark')).close();

await browser.close();
console.log(`wrote the captures into ${outDir}`);
