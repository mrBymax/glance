// Writes the poster of the hero: the last frame of the animation, on a clear background, as AVIF and WebP.
// It needs the dev server (npm run dev) and a local Chrome. CHROME_PATH names Chrome when it is not in the default place.
//   node scripts/capture-poster.mjs [page URL]
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const url = process.argv[2] ?? 'http://localhost:18420/?poster';
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = (path) => fileURLToPath(new URL(`../src/assets/generated/${path}`, import.meta.url));

// SwiftShader gives headless Chrome a WebGL context without a GPU.
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.documentElement.dataset.posterReady === 'true', { timeout: 30000 });
// The canvas keeps its drawing buffer, so its pixels are the last frame, with a clear background.
const dataUrl = await page.$eval('.hero-media__canvas', (canvas) => canvas.toDataURL('image/png'));
await browser.close();

const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
await writeFile(fileURLToPath(new URL('../media/hero-poster.png', import.meta.url)), png);
for (const width of [480, 960, 1440]) {
  const image = sharp(png).resize(width, width);
  await image.clone().avif({ quality: 60, effort: 6 }).toFile(out(`hero-poster-${width}.avif`));
  await image.clone().webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(out(`hero-poster-${width}.webp`));
}
console.log('wrote media/hero-poster.png and the hero-poster images into src/assets/generated');
