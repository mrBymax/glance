// Copies the media of the site and of the project into docs/pitch/assets/media, at the sizes of the deck.
// It needs the package sharp: SHARP_FROM names a package.json next to a node_modules with sharp.
//   node docs/pitch/scripts/prepare-assets.mjs
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.SHARP_FROM ?? 'C:/Users/marco/Desktop/glance-wt/site/apps/site/package.json');
const sharp = require('sharp');
const repo = (path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const media = (path) => fileURLToPath(new URL(`../assets/media/${path}`, import.meta.url));
const captures = (path) => fileURLToPath(new URL(`../assets/screens/${path}`, import.meta.url));
await mkdir(media(''), { recursive: true });

// The four portraits, cut to 4:5 by the site build, in alphabetical order of the first name.
for (const id of ['adb', 'fb', 'mc', 'ml']) {
  await sharp(repo(`apps/site/src/assets/generated/team-${id}-640.webp`)).jpeg({ quality: 88, mozjpeg: true }).toFile(media(`team-${id}.jpg`));
}
// A team photo with the face pixelated by the site build: what the phone does to each face before upload.
await sharp(repo('apps/site/src/assets/generated/privacy-face-640.webp')).png().toFile(media('privacy-face.png'));
// The slim logo files of the site build.
await copyFile(repo('apps/site/src/assets/generated/logo-light.svg'), media('logo-light.svg'));
await copyFile(repo('apps/site/src/assets/generated/logo-dark.svg'), media('logo-dark.svg'));
// The settings of the phone app, from the head gestures to the head window (the rows of the main yes input are cut).
await sharp(captures('phone-settings-input.png')).extract({ left: 0, top: 230, width: 1170, height: 1420 }).png().toFile(media('phone-settings-head.png'));
// The animation frames: the mark with its name, and the Glance code at the end, each trimmed to its drawing.
await sharp(captures('hero-1_4s-z2.2.png')).trim().png().toFile(media('hero-mark.png'));
await sharp(captures('hero-6s.png')).trim().png().toFile(media('hero-code.png'));
console.log('wrote docs/pitch/assets/media');
