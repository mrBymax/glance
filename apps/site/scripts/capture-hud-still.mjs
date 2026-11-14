// Writes the still of the display mock: the HUD of public/hud in its key state, the rye bread that waits for the nod.
// It needs the dev server (npm run dev) and a local Chrome. CHROME_PATH names Chrome when it is not in the default place.
//   node scripts/capture-hud-still.mjs [HUD URL]
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const url = process.argv[2] ?? 'http://localhost:18420/hud/index.html';
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = (path) => fileURLToPath(new URL(`../src/assets/generated/${path}`, import.meta.url));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0' });
// Standing alone, the HUD is its own parent, so it takes the command of the site page from itself.
await page.evaluate(() => window.postMessage({ glanceHud: 'still' }, '*'));
await page.evaluate(() => document.fonts.ready);
await new Promise((resolve) => setTimeout(resolve, 800));
const png = await page.screenshot({ type: 'png' });
await browser.close();

for (const width of [600, 1200]) {
  const image = sharp(png).resize(width, width);
  await image.clone().avif({ quality: 60, effort: 6 }).toFile(out(`hud-still-${width}.avif`));
  await image.clone().webp({ quality: 85, effort: 6 }).toFile(out(`hud-still-${width}.webp`));
}
console.log('wrote the hud-still images into src/assets/generated');
