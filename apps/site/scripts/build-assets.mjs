// Writes the optimized images of the site into src/assets/generated. Run it after a source image changes: npm run assets.
//   - Each team photo of assets/team_pics becomes a 4:5 portrait in AVIF and WebP, at three widths.
//   - Each screen capture of media/ becomes AVIF and WebP at two widths.
//   - The kiosk code of the hero card becomes a PNG with the white margin that the animation README asks for.
// The output is committed, so a build needs neither sharp nor qrcode.
import { mkdir, writeFile } from 'node:fs/promises';
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
const QR_SIZE = 1024;
// assets/animation/README.md: about 10 percent of white margin for the square card.
const QR_MARGIN = 0.1;

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

// Screens of the app, captured from the replay mode of the phone app and the kiosk page (see README.md, "Asset pipeline").
const SCREENS = [
  ...['prompt', 'checkout', 'paid'].flatMap((name) => ['light', 'dark'].map((mode) => ({ file: `phone-${name}-${mode}`, widths: [390, 780] }))),
  { file: 'kiosk-waiting', widths: [800, 1600] },
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

const pad = Math.round(QR_SIZE * QR_MARGIN);
const code = await QRCode.toBuffer(KIOSK_CODE_TEXT, { errorCorrectionLevel: 'M', margin: 0, width: QR_SIZE - pad * 2, color: { dark: '#000000', light: '#ffffff' } });
const card = await sharp(code)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();
await writeFile(out('kiosk-code.png'), card);

console.log(`wrote ${TEAM_PHOTOS.length * WIDTHS.length * 2} team images, ${SCREENS.length * 4} screen images, and kiosk-code.png into src/assets/generated`);
