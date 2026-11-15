// Draws the Glance code sticker of the bus page: a real QR code that holds a valid Glance code, in the style of the
// kiosk page (error correction M, a quiet zone of 4 modules, black on white) on the black plate of the site.
// Writes assets/media/glance-sticker.svg and glance-sticker.png (the PNG with the font of the deck, by Chrome).
//   node docs/pitch/scripts/sticker.mjs [code]
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(process.env.PUPPETEER_FROM ?? 'C:/Users/marco/Desktop/glance/scripts/integration/package.json');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const media = (path) => fileURLToPath(new URL(`../assets/media/${path}`, import.meta.url));

// The format of packages/shared/src/kioskCode.ts: GL1, one space, 4 to 8 characters from A-Z and 0-9.
// BUS4 has none of the letters and digits that the server leaves out (I, O, 0, 1). No place has this code today.
const code = process.argv[2] ?? 'BUS4';
if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error(`${code} is not the code of a place`);
const text = `GL1 ${code}`;

const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
const quiet = 4;
const count = modules.size + quiet * 2;
const card = 520;
const unit = card / count;
// One path of horizontal runs, drawn with crisp edges, so no seam shows between two modules.
let cells = '';
for (let row = 0; row < modules.size; row += 1) {
  let col = 0;
  while (col < modules.size) {
    if (!modules.get(row, col)) {
      col += 1;
      continue;
    }
    let end = col;
    while (end < modules.size && modules.get(row, end)) end += 1;
    const x = 40 + (col + quiet) * unit;
    const y = 40 + (row + quiet) * unit;
    cells += `M${x.toFixed(2)} ${y.toFixed(2)}h${((end - col) * unit).toFixed(2)}v${(unit + 0.3).toFixed(2)}h${(-(end - col) * unit).toFixed(2)}z`;
    col = end;
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 780" width="600" height="780" role="img" aria-labelledby="sticker-title">
<title id="sticker-title">Glance code ${text}</title>
<rect width="600" height="780" rx="56" fill="#1b1b1b"/>
<rect x="40" y="40" width="${card}" height="${card}" rx="24" fill="#ffffff"/>
<path fill="#000000" shape-rendering="crispEdges" d="${cells}"/>
<text x="300" y="660" text-anchor="middle" font-family="'Optimistic VF', 'Segoe UI', Arial, sans-serif" font-size="40" font-weight="650" fill="#ffffff">Look here. Nod to pay.</text>
<text x="300" y="718" text-anchor="middle" font-family="'Optimistic VF', 'Segoe UI', Arial, sans-serif" font-size="30" font-weight="500" fill="#9e9e9e" letter-spacing="2">${text}</text>
</svg>
`;
await writeFile(media('glance-sticker.svg'), svg);

// The PNG: the SVG on a page with the font of the deck, at 2x.
const font = pathToFileURL(fileURLToPath(new URL('../../../apps/site/public/fonts/OptimisticVF.woff2', import.meta.url))).href;
const html = `<!doctype html><html><head><style>@font-face{font-family:'Optimistic VF';src:url('${font}') format('woff2');font-weight:300 800}
html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`;
const pagePath = media('glance-sticker.tmp.html');
await writeFile(pagePath, html);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 600, height: 780, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(pagePath).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: media('glance-sticker.png'), omitBackground: true, clip: { x: 0, y: 0, width: 600, height: 780 } });
await browser.close();
const { rm } = await import('node:fs/promises');
await rm(pagePath);
console.log(`wrote the sticker of ${text}: assets/media/glance-sticker.svg and .png`);
