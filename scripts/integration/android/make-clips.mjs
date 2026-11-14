// Makes the camera feeds of the mock glasses for the instrumented tests of the Android app:
//   scene.mp4                   a plain scene with four colored boxes
//   kiosk.mp4                   the QR code "GL1 K3X7" on white
//   scene.png                   the plain scene as a still image
//   barcode.mp4                 the EAN-13 code 4006381333931 with its digits, 5 pixels for each narrow bar
//   barcode.png                 the same code as a still image
//   barcode-digits.mp4          the digits of the code 8076809513753 where a barcode prints them, with no bars
//   barcode-blurred.mp4         the bars of the code 3017624010701 with a blur that hides each narrow bar, and no digits
//   barcode-blurred.png         the same blurred bars as a still image
//   barcode-blurred-digits.mp4  the same blurred bars with sharp digits under them
// MockDeviceKit takes an h265 file on Android, so FFmpeg with libx265 must be on PATH.
// Use: node android/make-clips.mjs [--force]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

const here = dirname(fileURLToPath(import.meta.url));
export const ASSETS_DIR = resolve(here, '../../../apps/mobile/android/app/src/androidTest/assets');

const WIDTH = 720;
const HEIGHT = 1280;
const KIOSK_TEXT = 'GL1 K3X7';
const QR_SIZE = 480;
const CLIP_SECONDS = 20;
const FRAMES_PER_SECOND = 15;

// The instrumented test BarcodeScanTest expects these codes. Keep both in step.
const BARCODE_TEXT = '4006381333931';
const DIGITS_TEXT = '8076809513753';
const BLURRED_TEXT = '3017624010701';
/** The pixels of one narrow bar. ML Kit asks for 2 at least, so 5 decodes with a margin. */
const BAR_PIXELS = 5;
const BAR_HEIGHT_MM = 20;
/**
 * The blur radius in pixels. Measured with ML Kit on the test phone, 2026-11-14, for bars of 5 pixels: the scanner
 * decodes the code at 6, decodes it only in the larger crop at 8, and reports a region with no code from 10 to 16.
 * At 20, with sharp digits on the bars, it gave the wrong code 3777654524301. At 26 it finds no region.
 */
const BLUR_SIGMA = 12;
/** The white edge around the bars before the blur, so the blur has room. */
const BLUR_EDGE = 80;
const BLACK = '000000';
const WHITE = 'FFFFFF';

// The instrumented test FrameColorTest reads these boxes back from a frame. Keep both in step.
const BACKGROUND = '0xD8D2C4';
const BOXES = [
  { x: 60, y: 200, color: '0xC81E1E' },
  { x: 420, y: 200, color: '0x1E9A3C' },
  { x: 60, y: 760, color: '0x1E46C8' },
  { x: 420, y: 760, color: '0xE6C81E' },
];
const BOX_WIDTH = 240;
const BOX_HEIGHT = 320;

const PAD = `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:white`;

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (run.error) throw new Error(`FFmpeg did not start: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`FFmpeg failed with status ${run.status}:\n${run.stderr}`);
}

function makeScene(file) {
  const boxes = BOXES.map((box) => `drawbox=x=${box.x}:y=${box.y}:w=${BOX_WIDTH}:h=${BOX_HEIGHT}:color=${box.color}:t=fill`);
  ffmpeg(['-f', 'lavfi', '-i', `color=c=${BACKGROUND}:s=${WIDTH}x${HEIGHT}`, '-vf', boxes.join(','), '-frames:v', '1', file]);
}

async function makeKioskImage(text, file, work) {
  const code = join(work, 'code.png');
  await QRCode.toFile(code, text, { errorCorrectionLevel: 'M', margin: 4, width: QR_SIZE });
  ffmpeg(['-i', code, '-vf', PAD, '-frames:v', '1', file]);
}

/**
 * Writes an EAN-13 symbol with no frame around it. White bars or no text give a symbol with digits only or
 * with bars only, and each part keeps its place, so two such images fit one on the other.
 */
async function writeSymbol(text, file, { bars = true, digits = true } = {}) {
  const png = await bwipjs.toBuffer({
    bcid: 'ean13',
    text,
    scale: BAR_PIXELS,
    height: BAR_HEIGHT_MM,
    includetext: true,
    barcolor: bars ? BLACK : WHITE,
    textcolor: digits ? BLACK : WHITE,
    backgroundcolor: WHITE,
  });
  writeFileSync(file, png);
}

async function makeBarcodeImage(text, file, work) {
  const symbol = join(work, 'symbol.png');
  await writeSymbol(text, symbol);
  ffmpeg(['-i', symbol, '-vf', PAD, '-frames:v', '1', file]);
}

async function makeDigitsImage(text, file, work) {
  const symbol = join(work, 'digits.png');
  await writeSymbol(text, symbol, { bars: false });
  ffmpeg(['-i', symbol, '-vf', PAD, '-frames:v', '1', file]);
}

/** The bars with a blur. With `digits`, the sharp digits go on the blurred bars. */
async function makeBlurredImage(text, file, work, { digits }) {
  const bars = join(work, 'bars.png');
  const sharp = join(work, 'sharp-digits.png');
  await writeSymbol(text, bars, { digits: false });
  await writeSymbol(text, sharp, { bars: false, digits });
  // "darken" keeps the darker pixel of both images.
  const edge = `pad=iw+${2 * BLUR_EDGE}:ih+${2 * BLUR_EDGE}:${BLUR_EDGE}:${BLUR_EDGE}:white`;
  const filter = `[0:v]format=gbrp,${edge},gblur=sigma=${BLUR_SIGMA}[blurred];[1:v]format=gbrp,${edge}[digits];[blurred][digits]blend=all_mode=darken,${PAD}`;
  ffmpeg(['-i', bars, '-i', sharp, '-filter_complex', filter, '-frames:v', '1', file]);
}

// One key frame each second, so a player that starts in the middle of the file shows a picture at once.
function makeClip(image, file) {
  ffmpeg([
    '-loop', '1', '-framerate', String(FRAMES_PER_SECOND), '-i', image, '-t', String(CLIP_SECONDS),
    '-vf', `scale=${WIDTH}:${HEIGHT}:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx265', '-preset', 'medium', '-crf', '20',
    '-x265-params', `keyint=${FRAMES_PER_SECOND}:min-keyint=${FRAMES_PER_SECOND}:log-level=error`,
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-tag:v', 'hvc1', '-an', '-movflags', '+faststart', file,
  ]);
}

/** Makes a clip from the image that `makeImage(file)` writes. */
async function clipOf(file, work, makeImage) {
  const image = join(work, 'image.png');
  await makeImage(image);
  makeClip(image, file);
}

/** One maker for each file of the assets folder. A maker gets the path of the file and a work folder. */
const MAKERS = {
  'scene.png': (file) => makeScene(file),
  'scene.mp4': (file, work) => clipOf(file, work, (image) => makeScene(image)),
  'kiosk.mp4': (file, work) => clipOf(file, work, (image) => makeKioskImage(KIOSK_TEXT, image, work)),
  'barcode.png': (file, work) => makeBarcodeImage(BARCODE_TEXT, file, work),
  'barcode.mp4': (file, work) => clipOf(file, work, (image) => makeBarcodeImage(BARCODE_TEXT, image, work)),
  'barcode-digits.mp4': (file, work) => clipOf(file, work, (image) => makeDigitsImage(DIGITS_TEXT, image, work)),
  'barcode-blurred.png': (file, work) => makeBlurredImage(BLURRED_TEXT, file, work, { digits: false }),
  'barcode-blurred.mp4': (file, work) => clipOf(file, work, (image) => makeBlurredImage(BLURRED_TEXT, image, work, { digits: false })),
  'barcode-blurred-digits.mp4': (file, work) => clipOf(file, work, (image) => makeBlurredImage(BLURRED_TEXT, image, work, { digits: true })),
};
export const CLIPS = Object.keys(MAKERS);

/** Makes one clip with the QR code of `text` on white, for a kiosk that has another code than the fixed clip. */
export async function makeKioskClip(text, file) {
  const work = mkdtempSync(join(tmpdir(), 'glance-clips-'));
  try {
    await clipOf(file, work, (image) => makeKioskImage(text, image, work));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Makes the files that are missing. With `force`, makes each file again. Returns the folder of the files. */
export async function makeClips({ force = false } = {}) {
  const names = CLIPS.filter((name) => force || !existsSync(join(ASSETS_DIR, name)));
  if (names.length === 0) return ASSETS_DIR;
  mkdirSync(ASSETS_DIR, { recursive: true });
  for (const name of names) {
    const work = mkdtempSync(join(tmpdir(), 'glance-clips-'));
    try {
      await MAKERS[name](join(ASSETS_DIR, name), work);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  return ASSETS_DIR;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = await makeClips({ force: process.argv.includes('--force') });
  console.log(`clips: ${CLIPS.join(', ')} in ${dir}`);
}
