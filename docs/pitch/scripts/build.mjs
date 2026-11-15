// Builds the pitch deck: deck.src.html -> deck.html -> Meta-Glance-pitch.pdf and slides/NN-name.png.
// It replaces {{icon name size}} with a Lucide icon, {{diagram slug}} with the SVG of diagrams/<slug>.html, and
// {{photo name|description}} with assets/photos/<name>.jpg or an empty photo slot, prints the slides with headless
// Chrome at 1920 x 1080, one slide per page, and checks each slide for overflow.
//   node docs/pitch/scripts/diagrams.mjs && node docs/pitch/scripts/build.mjs
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { iconSvg } from './lib.mjs';

const require = createRequire(process.env.PUPPETEER_FROM ?? 'C:/Users/marco/Desktop/glance/scripts/integration/package.json');
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const here = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

// The anti-slop character check: a banned character stops the build.
execFileSync(process.execPath, [fileURLToPath(new URL('check-chars.mjs', import.meta.url))], { stdio: 'inherit' });

let html = await readFile(here('deck.src.html'), 'utf8');

/*
 * A photo slot: {{photo name|description}}, or {{photo name|description|sticker}} to show the Glance code sticker in
 * the empty slot. When assets/photos/<name>.jpg exists, the slot shows that photo. Otherwise it shows a framed slot
 * with the shot description, so only the image is missing.
 */
const photos = [];
html = html.replace(/\{\{photo ([a-z0-9-]+)\|([^|}]+)(?:\|(sticker))?\}\}/g, (_, name, description, extra) => {
  const file = `assets/photos/${name}.jpg`;
  const hasPhoto = existsSync(here(file));
  photos.push(`${name} (${hasPhoto ? 'photo' : 'slot'})`);
  if (hasPhoto) return `<img class="photo__img" src="${file}" alt="${description.replace(/^PHOTO: /, '')}">`;
  const sticker = extra === 'sticker' ? '<img class="photo__sticker" src="assets/media/glance-sticker.svg" alt="The Glance code sticker GL1 BUS4.">' : '';
  return `<div class="photo__slot" data-photo="${name}">${sticker}<div class="photo__label"><span class="footage__mark">{{icon camera 28}} Photo</span><p class="photo__text">${description}</p><p class="photo__file">${file}</p></div></div>`;
});
html = html.replace(/\{\{icon ([a-z0-9-]+) (\d+)\}\}/g, (_, name, size) => iconSvg(name, { size: Number(size) }));
const diagramSlugs = [...html.matchAll(/\{\{diagram ([a-z0-9-]+)\}\}/g)].map((match) => match[1]);
for (const slug of diagramSlugs) {
  const page = await readFile(here(`diagrams/${slug}.html`), 'utf8');
  const svg = page.slice(page.indexOf('<svg'), page.lastIndexOf('</svg>') + 6);
  html = html.replace(`{{diagram ${slug}}}`, svg);
}
if (/\{\{/.test(html)) throw new Error('a placeholder was left in deck.html');
await writeFile(here('deck.html'), html);

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(here('deck.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const fontOk = await page.evaluate(() => document.fonts.check("650 64px 'Optimistic VF'"));
if (!fontOk) throw new Error('Optimistic VF did not load');

// Each element must stay inside its slide, and no text may be under 24 px.
const report = await page.evaluate(() => {
  const problems = [];
  document.querySelectorAll('.slide').forEach((slide, index) => {
    const box = slide.getBoundingClientRect();
    slide.querySelectorAll('*').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right > box.right + 1 || rect.bottom > box.bottom + 1 || rect.left < box.left - 1) {
        problems.push(`slide ${index + 1}: ${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} leaves the slide`);
      }
      const isText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim() !== '');
      if (isText && element.closest('svg') === null) {
        const size = parseFloat(getComputedStyle(element).fontSize);
        if (size < 24) problems.push(`slide ${index + 1}: text of ${size} px in ${element.tagName.toLowerCase()}`);
      }
      if (element.tagName.toLowerCase() === 'text') {
        const size = parseFloat(element.getAttribute('font-size') ?? '0');
        const scale = element.ownerSVGElement.getBoundingClientRect().width / element.ownerSVGElement.viewBox.baseVal.width;
        if (size * scale < 23.5) problems.push(`slide ${index + 1}: svg text of ${(size * scale).toFixed(1)} px`);
      }
      // A text element that is wider than its parent clips or overflows.
      if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow === 'hidden' && element !== slide) {
        problems.push(`slide ${index + 1}: ${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} clips its content`);
      }
    });
    if (slide.scrollHeight > slide.clientHeight + 1) problems.push(`slide ${index + 1}: content is taller than the slide`);
  });
  return problems;
});
for (const line of report) console.warn(line);

await rm(here('slides'), { recursive: true, force: true });
await mkdir(here('slides'), { recursive: true });
const slides = await page.$$eval('.slide', (nodes) => nodes.map((node) => node.dataset.name));
for (const [index, name] of slides.entries()) {
  const element = (await page.$$('.slide'))[index];
  const file = `slides/${String(index + 1).padStart(2, '0')}-${name}.png`;
  await element.screenshot({ path: here(file) });
}

await page.emulateMediaType('print');
await page.pdf({ path: here('Meta-Glance-pitch.pdf'), width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true, pageRanges: '' });
await browser.close();
console.log(`built deck.html, Meta-Glance-pitch.pdf, and ${slides.length} slides; ${report.length} layout warnings; photos: ${photos.join(', ') || 'none'}`);
