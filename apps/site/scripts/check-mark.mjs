// Checks the mark of the hero against the logo symbol of assets/Glance Dark.svg, at the moments when it faces the viewer.
// It needs the dev server (npm run dev) and a local Chrome. CHROME_PATH names Chrome when it is not in the default place.
//   node scripts/check-mark.mjs [page URL] [out dir]
// For each viewport and each moment, it opens `?frame=<seconds>`, finds the blue mark in the hero, sets the symbol on its
// box at one scale, and measures:
//   - the silhouette: intersection over union of the two shapes;
//   - the colors: the mean color around 15 points of the stroke (both loops, the crossing, the bottoms), as CIEDE2000;
//     a point is lighter when L* is 2 higher than in the symbol, greyer when its chroma is 3 lower.
// It writes <out dir>/<moment>-side.png (render and symbol, side by side), <moment>-overlay.png (the outline of the
// symbol in white on the render, the render outside it in red, the symbol outside the render in green), and
// <moment>-report.json, and exits with 1 when a check fails.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const url = process.argv[2] ?? 'http://localhost:18420/';
const outDir = process.argv[3] ?? fileURLToPath(new URL('../check-mark/', import.meta.url));
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// The first frame, and the hold before the mark grows into the card. Both face the viewer.
const MOMENTS = [0, 2];
// Device pixel ratio 2, as on most screens: at 1 the edge pixels of a mark 166 px wide weigh on the IoU.
const VIEWPORTS = [
  [1440, 900, 2],
  [360, 800, 2],
];
const LIMITS = { iou: 0.97, deltaE: 5 };

// The outline of the symbol in the units of the logo file.
const SYMBOL = { x: 567.69, y: 1000, width: 1505.24, height: 1000 };
const POINTS = [
  ['left loop, top', 1003, 1080],
  ['left loop, upper left', 715, 1290],
  ['left loop, left side', 650, 1600],
  ['left loop, bottom', 845, 1920],
  ['left loop, inner bottom right', 1010, 1880],
  ['rising strand, low', 1125, 1690],
  ['rising strand, near crossing', 1250, 1470],
  ['crossing, front strand', 1318, 1390],
  ['front strand, upper', 1200, 1230],
  ['front strand, lower', 1500, 1600],
  ['right loop, bottom', 1815, 1920],
  ['right loop, right side', 2005, 1600],
  ['right loop, top', 1645, 1065],
  ['right loop, upper left', 1420, 1230],
  ['right loop, inner bottom', 1960, 1840],
];

const source = await readFile(fileURLToPath(new URL('../../../assets/Glance Dark.svg', import.meta.url)), 'utf8');
const symbolSvg = source
  .replace(/<g id="Artboard_outline"[\s\S]*?<\/g>/, '')
  .replace(/(<g id="Symbol">\s*)<g>[\s\S]*?<\/g>/, '$1')
  .replace(/viewBox="[^"]+"/, `viewBox="${SYMBOL.x} ${SYMBOL.y} ${SYMBOL.width} ${SYMBOL.height}"`);

function toLab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const [a1p, a2p] = [(1 + G) * a1, (1 + G) * a2];
  const [C1p, C2p] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const hue = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const [h1p, h2p] = [hue(a1p, b1), hue(a2p, b2)];
  let dhp = 0;
  if (C1p * C2p !== 0) dhp = h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p < -180 ? h2p - h1p + 360 : h2p - h1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = (Math.abs(h1p - h2p) > 180 ? hbp + (hbp < 360 ? 360 : -360) : hbp) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Rt = -Math.sin(2 * 30 * Math.exp(-(((hbp - 275) / 25) ** 2)) * rad) * Rc;
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  return Math.sqrt(((L2 - L1) / Sl) ** 2 + ((C2p - C1p) / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * ((C2p - C1p) / Sc) * (dHp / Sh));
}

const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Compares one frame of the hero (PNG) with the symbol. */
async function compare(png, name) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // The mark: the blue pixels (the subtitle and the stage are grey, the card is white).
  const mask = new Uint8Array(W * H);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let k = 0; k < W * H; k += 1) {
    const [r, g, b] = [data[k * 3], data[k * 3 + 1], data[k * 3 + 2]];
    if (b > 110 && b > r + 70 && b > g + 20) {
      mask[k] = 1;
      const x = k % W;
      const y = (k - x) / W;
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  if (x1 < 0) throw new Error(`${name}: no mark in the frame`);
  const scale = ((x1 - x0 + 1) / SYMBOL.width + (y1 - y0 + 1) / SYMBOL.height) / 2;
  const [rw, rh] = [Math.round(SYMBOL.width * scale), Math.round(SYMBOL.height * scale)];
  const left = Math.round((x0 + x1 + 1) / 2 - rw / 2);
  const top = Math.round((y0 + y1 + 1) / 2 - rh / 2);
  const symbol = await sharp(Buffer.from(symbolSvg), { density: Math.max(72, 72 * scale) }).resize(rw, rh).ensureAlpha().raw().toBuffer();

  // The stage without the mark: each pixel near the mark takes the nearest stage pixel to its left (a smooth gradient).
  const near = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k += 1) {
    if (!mask[k]) continue;
    const x = k % W;
    const y = (k - x) / W;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H) near[(y + dy) * W + x + dx] = 1;
  }
  const reference = Buffer.from(data);
  for (let y = 0; y < H; y += 1) {
    let stage = -1;
    for (let x = 0; x < W; x += 1) {
      const k = y * W + x;
      if (!near[k]) stage = k;
      else if (stage >= 0) reference.copyWithin(k * 3, stage * 3, stage * 3 + 3);
    }
  }
  // The symbol on that stage, at the place and size of the mark.
  const symbolMask = new Uint8Array(W * H);
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const [X, Y] = [left + x, top + y];
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const s = (y * rw + x) * 4;
      const alpha = symbol[s + 3] / 255;
      const k = Y * W + X;
      for (let c = 0; c < 3; c += 1) reference[k * 3 + c] = Math.round(symbol[s + c] * alpha + reference[k * 3 + c] * (1 - alpha));
      if (alpha >= 0.5) symbolMask[k] = 1;
    }
  }

  let [inter, union] = [0, 0];
  for (let k = 0; k < W * H; k += 1) {
    if (mask[k] && symbolMask[k]) inter += 1;
    if (mask[k] || symbolMask[k]) union += 1;
  }
  const radius = Math.max(1, Math.round(scale * 12));
  const meanAt = (image, px, py) => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = py - radius; y <= py + radius; y += 1) {
      for (let x = px - radius; x <= px + radius; x += 1) {
        for (let c = 0; c < 3; c += 1) sum[c] += image[(y * W + x) * 3 + c];
        n += 1;
      }
    }
    return sum.map((v) => v / n);
  };
  const points = POINTS.map(([label, ux, uy]) => {
    const px = Math.round(left + (ux - SYMBOL.x) * scale);
    const py = Math.round(top + (uy - SYMBOL.y) * scale);
    const [render, logo] = [meanAt(data, px, py), meanAt(reference, px, py)];
    const [labRender, labLogo] = [toLab(render), toLab(logo)];
    return {
      label,
      px,
      py,
      render: hex(render),
      logo: hex(logo),
      deltaE: Number(deltaE2000(labLogo, labRender).toFixed(2)),
      lighter: labRender[0] - labLogo[0] > 2,
      greyer: Math.hypot(labRender[1], labRender[2]) - Math.hypot(labLogo[1], labLogo[2]) < -3,
    };
  });
  const report = {
    frame: name,
    mark: { width: x1 - x0 + 1, height: y1 - y0 + 1, aspect: Number(((x1 - x0 + 1) / (y1 - y0 + 1)).toFixed(3)), symbolAspect: Number((SYMBOL.width / SYMBOL.height).toFixed(3)) },
    iou: Number((inter / union).toFixed(4)),
    maxDeltaE: Math.max(...points.map((p) => p.deltaE)),
    points,
  };
  report.pass = report.iou >= LIMITS.iou && report.maxDeltaE <= LIMITS.deltaE && points.every((p) => !p.lighter && !p.greyer);

  // The images.
  const overlay = Buffer.from(data);
  for (let k = W; k < W * (H - 1); k += 1) {
    const edge = symbolMask[k] && (!symbolMask[k - 1] || !symbolMask[k + 1] || !symbolMask[k - W] || !symbolMask[k + W]);
    const color = edge ? [255, 255, 255] : mask[k] && !symbolMask[k] ? [255, 40, 40] : !mask[k] && symbolMask[k] ? [40, 220, 80] : null;
    if (color) overlay.set(color, k * 3);
  }
  for (const { px, py } of points) {
    for (let y = py - radius; y <= py + radius; y += 1) {
      for (let x = px - radius; x <= px + radius; x += 1) if (Math.abs(y - py) === radius || Math.abs(x - px) === radius) overlay.set([255, 220, 0], (y * W + x) * 3);
    }
  }
  const pad = Math.round(scale * 60);
  const crop = { left: Math.max(0, left - pad), top: Math.max(0, top - pad) };
  Object.assign(crop, { width: Math.min(W - crop.left, rw + 2 * pad), height: Math.min(H - crop.top, rh + 2 * pad) });
  const raw = { raw: { width: W, height: H, channels: 3 } };
  await sharp(overlay, raw).extract(crop).resize({ width: 900 }).png().toFile(join(outDir, `${name}-overlay.png`));
  const renderCrop = await sharp(data, raw).extract(crop).resize({ width: 900 }).png().toBuffer();
  const symbolCrop = await sharp(reference, raw).extract(crop).resize({ width: 900 }).png().toBuffer();
  const height = (await sharp(renderCrop).metadata()).height;
  const label = (text) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="40"><text x="10" y="28" font-family="Arial" font-size="22" fill="#fff">${text}</text></svg>`);
  await sharp({ create: { width: 1820, height: height + 40, channels: 3, background: '#111111' } })
    .composite([
      { input: label(`Hero, ${name}`), left: 0, top: 0 },
      { input: renderCrop, left: 0, top: 40 },
      { input: label('Symbol of Glance Dark.svg, same size and place'), left: 920, top: 0 },
      { input: symbolCrop, left: 920, top: 40 },
    ])
    .png()
    .toFile(join(outDir, `${name}-side.png`));
  await writeFile(join(outDir, `${name}-report.json`), JSON.stringify(report, null, 2));
  return report;
}

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
for (const [width, height, ratio] of VIEWPORTS) {
  for (const moment of MOMENTS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: ratio });
    const frameUrl = new URL(url);
    frameUrl.searchParams.set('frame', String(moment));
    await page.goto(frameUrl.href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.frameReady === 'true', { timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const frame = await (await page.$('.hero-media__frame')).screenshot();
    await page.close();
    const report = await compare(frame, `${width}x${height}-t${moment}`);
    failed ||= !report.pass;
    console.log(`${report.frame}: IoU ${report.iou}, largest CIEDE2000 ${report.maxDeltaE}, aspect ${report.mark.aspect} (symbol ${report.mark.symbolAspect}) ${report.pass ? 'pass' : 'FAIL'}`);
    for (const p of report.points) console.log(`  ${p.label.padEnd(30)} ${p.render} vs ${p.logo}  dE ${p.deltaE}${p.lighter ? ' lighter' : ''}${p.greyer ? ' greyer' : ''}`);
  }
}
await browser.close();
console.log(failed ? 'FAIL' : 'OK');
process.exitCode = failed ? 1 : 0;
