// Writes the optimized images of the site into src/assets/generated. Run it after a source image changes: npm run assets.
//   - Each team photo of assets/team_pics becomes a 4:5 portrait in AVIF and WebP, at three widths.
//   - Each screen capture of the phone app in media/ becomes AVIF and WebP at two widths.
//   - The Glance code of the kiosk drawing, and the code on the card at the end of the hero, which holds the address of
//     the repository, become PNGs with a quiet zone of four modules.
// The output is committed, so a build needs neither sharp nor qrcode.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const repo = (path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const out = (path) => fileURLToPath(new URL(`../src/assets/generated/${path}`, import.meta.url));

const TEAM_PHOTOS = ['adb', 'fb', 'mc', 'ml'];
const WIDTHS = [320, 480, 640];
const RATIO = 5 / 4;

// The same text as the kiosk of the demo server: "GL1 " and the kiosk code (apps/website on the app branch).
const KIOSK_CODE_TEXT = 'GL1 K3X7';
// The address of the repository, as src/content/site.ts states it (REPOSITORY_URL).
const REPOSITORY_URL = 'https://github.com/mrBymax/glance';
const QR_SIZE = 1024;

await mkdir(out(''), { recursive: true });

for (const id of TEAM_PHOTOS) {
  const source = repo(`assets/team_pics/${id}.jpeg`);
  for (const width of WIDTHS) {
    const height = Math.round(width * RATIO);
    // "attention" keeps the face in the crop. One photo is landscape, with other people beside the face.
    const portrait = sharp(source).rotate().resize(width, height, { fit: 'cover', position: sharp.strategy.attention });
    await portrait.clone().avif({ quality: 52, effort: 6 }).toFile(out(`team-${id}-${width}.avif`));
    await portrait.clone().webp({ quality: 74, effort: 6 }).toFile(out(`team-${id}-${width}.webp`));
  }
}

// Screens of the phone app, captured from its replay mode (see README.md, "Asset pipeline").
const SCREENS = [
  ...['prompt', 'checkout', 'paid'].flatMap((name) => ['light', 'dark'].map((mode) => ({ file: `phone-${name}-${mode}`, widths: [390, 780] }))),
];
for (const { file, widths } of SCREENS) {
  for (const width of widths) {
    const image = sharp(fileURLToPath(new URL(`../media/${file}.png`, import.meta.url))).resize({ width });
    await image.clone().avif({ quality: 60, effort: 6 }).toFile(out(`${file}-${width}.avif`));
    await image.clone().webp({ quality: 82, effort: 6 }).toFile(out(`${file}-${width}.webp`));
  }
}

// The privacy chapter shows one team photo as the phone sends it: the box of the face in blocks.
// The box is a fixed part of the 4:5 crop of fb.jpeg, set by eye. It stands in for the box of the face detector.
const FACE_BOX = { left: 0.17, top: 0.1, width: 0.72, height: 0.66 };
const BLOCK = 0.06;
for (const width of [320, 480, 640]) {
  const height = Math.round(width * RATIO);
  const portrait = await sharp(repo('assets/team_pics/fb.jpeg')).rotate().resize(width, height, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
  const box = {
    left: Math.round(FACE_BOX.left * width),
    top: Math.round(FACE_BOX.top * height),
    width: Math.round(FACE_BOX.width * width),
    height: Math.round(FACE_BOX.height * height),
  };
  const block = Math.max(4, Math.round(BLOCK * width));
  // A sharp pipeline keeps only its last resize, so the scale down and the scale up are two pipelines.
  const small = await sharp(portrait)
    .extract(box)
    .resize(Math.ceil(box.width / block), Math.ceil(box.height / block), { kernel: 'cubic', fit: 'fill' })
    .toBuffer();
  const blocks = await sharp(small).resize(box.width, box.height, { kernel: 'nearest', fit: 'fill' }).toBuffer();
  const pixelated = sharp(portrait).composite([{ input: blocks, left: box.left, top: box.top }]);
  await pixelated.clone().avif({ quality: 52, effort: 6 }).toFile(out(`privacy-face-${width}.avif`));
  await pixelated.clone().webp({ quality: 74, effort: 6 }).toFile(out(`privacy-face-${width}.webp`));
}

// The logo files of assets/. Each one holds a 3157 x 2105 PNG as the fill of the symbol, so a file weighs 357 KB.
// The copies of the site keep each path and each color, hold that fill as a smaller WebP, drop the empty artboard,
// and crop the view box to the drawing.
const LOGO_VIEW_BOX = '548 980 5866 1040';
const SYMBOL_VIEW_BOX = '520 700 1600 1600';
const LOGO_SOURCES = { light: 'assets/Glance.svg', dark: 'assets/Glance Dark.svg' };

async function slimLogo(source, { viewBox, fillWidth, symbolOnly }) {
  let svg = await readFile(repo(source), 'utf8');
  const image = svg.match(/<image width="(\d+)" height="(\d+)" transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)" xlink:href="data:image\/png;base64,([^"]+)"\/>/);
  if (!image) throw new Error(`${source}: the symbol fill is not where scripts/build-assets.mjs expects it`);
  const [whole, width, height, x, y, scale, data] = image;
  const fillHeight = Math.round((Number(height) * fillWidth) / Number(width));
  const fill = await sharp(Buffer.from(data, 'base64')).resize(fillWidth, fillHeight).webp({ quality: 90 }).toBuffer();
  const newScale = (Number(scale) * Number(width)) / fillWidth;
  svg = svg.replace(whole, `<image width="${fillWidth}" height="${fillHeight}" transform="translate(${x} ${y}) scale(${newScale.toFixed(4)})" xlink:href="data:image/webp;base64,${fill.toString('base64')}"/>`);
  svg = svg.replace(/<g id="Artboard_outline"[\s\S]*?<\/g>\s*/, '');
  svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
  if (symbolOnly) svg = svg.replace(/<path class="cls-3"[^>]*\/>\s*/g, '');
  return svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/\n\s*/g, '\n');
}

for (const [mode, source] of Object.entries(LOGO_SOURCES)) {
  await writeFile(out(`logo-${mode}.svg`), await slimLogo(source, { viewBox: LOGO_VIEW_BOX, fillWidth: 800, symbolOnly: false }));
}
const publicDir = (path) => fileURLToPath(new URL(`../public/${path}`, import.meta.url));
await writeFile(publicDir('favicon.svg'), await slimLogo(LOGO_SOURCES.light, { viewBox: SYMBOL_VIEW_BOX, fillWidth: 400, symbolOnly: true }));
// PNG icons and the social preview come from the source files, which librsvg reads with their PNG fill.
const symbolCrop = { left: 520, top: 700, width: 1600, height: 1600 };
const symbolPng = await sharp(repo(LOGO_SOURCES.light), { density: 72 }).extract(symbolCrop).png().toBuffer();
await sharp(symbolPng).resize(32, 32).png().toFile(publicDir('favicon-32.png'));
await sharp(symbolPng).resize(140, 140).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toFile(publicDir('apple-touch-icon.png'));
const ogLogo = await sharp(repo(LOGO_SOURCES.light), { density: 72 }).extract({ left: 548, top: 980, width: 5866, height: 1040 }).resize(860).png().toBuffer();
const ogLogoHeight = (await sharp(ogLogo).metadata()).height;
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f1f1f1' } })
  .composite([{ input: ogLogo, left: 170, top: Math.round((630 - ogLogoHeight) / 2) }])
  .png()
  .toFile(publicDir('og-image.png'));

// The quiet zone of 4 modules that the QR standard asks for, as the kiosk page draws it. It is wider than the 10 percent
// that the animation README asks for, so the rounded corners of the card cut no finder square.
const card = await QRCode.toBuffer(KIOSK_CODE_TEXT, { errorCorrectionLevel: 'M', margin: 4, width: QR_SIZE, color: { dark: '#000000', light: '#ffffff' } });
await writeFile(out('kiosk-code.png'), card);
// The card of the hero: level Q corrects a quarter of the modules, for a code seen on a turning 3D card.
const repositoryCard = await QRCode.toBuffer(REPOSITORY_URL, { errorCorrectionLevel: 'Q', margin: 4, width: QR_SIZE, color: { dark: '#000000', light: '#ffffff' } });
await writeFile(out('repository-code.png'), repositoryCard);

console.log(`wrote ${TEAM_PHOTOS.length * WIDTHS.length * 2} team images, ${SCREENS.length * 4} screen images, kiosk-code.png, and repository-code.png into src/assets/generated`);
