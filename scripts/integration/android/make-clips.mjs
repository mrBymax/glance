// Makes the camera feeds of the mock glasses for the instrumented tests of the Android app:
//   scene.mp4  a plain scene with four colored boxes
//   kiosk.mp4  the QR code "GL1 K3X7" on white
//   scene.png  the plain scene as a still image
// MockDeviceKit takes an h265 file on Android, so FFmpeg with libx265 must be on PATH.
// Use: node android/make-clips.mjs [--force]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const here = dirname(fileURLToPath(import.meta.url));
export const ASSETS_DIR = resolve(here, '../../../apps/mobile/android/app/src/androidTest/assets');
export const CLIPS = ['scene.mp4', 'kiosk.mp4', 'scene.png'];

const WIDTH = 720;
const HEIGHT = 1280;
const KIOSK_TEXT = 'GL1 K3X7';
const QR_SIZE = 480;
const CLIP_SECONDS = 20;
const FRAMES_PER_SECOND = 15;

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
  ffmpeg(['-i', code, '-vf', `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:white`, '-frames:v', '1', file]);
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

/** Makes one clip with the QR code of `text` on white, for a kiosk that has another code than the fixed clip. */
export async function makeKioskClip(text, file) {
  const work = mkdtempSync(join(tmpdir(), 'glance-clips-'));
  try {
    const image = join(work, 'kiosk.png');
    await makeKioskImage(text, image, work);
    makeClip(image, file);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Makes the files that are missing. With `force`, makes each file again. Returns the folder of the files. */
export async function makeClips({ force = false } = {}) {
  if (!force && CLIPS.every((name) => existsSync(join(ASSETS_DIR, name)))) return ASSETS_DIR;
  mkdirSync(ASSETS_DIR, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'glance-clips-'));
  try {
    const scene = join(ASSETS_DIR, 'scene.png');
    const kiosk = join(work, 'kiosk.png');
    makeScene(scene);
    await makeKioskImage(KIOSK_TEXT, kiosk, work);
    makeClip(scene, join(ASSETS_DIR, 'scene.mp4'));
    makeClip(kiosk, join(ASSETS_DIR, 'kiosk.mp4'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return ASSETS_DIR;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = await makeClips({ force: process.argv.includes('--force') });
  console.log(`clips: ${CLIPS.join(', ')} in ${dir}`);
}
