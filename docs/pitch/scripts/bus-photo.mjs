// Makes assets/photos/bus-door.jpg: the bus photo (Pexels 8536723, Brett Sayles) with the Glance code sticker on the
// window panel left of the front door, in place of the yellow notice, cropped to the full-page photo slot.
//   node docs/pitch/scripts/bus-photo.mjs <path of pexels-8536723.jpeg>
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.SHARP_FROM ?? 'C:/Users/marco/Desktop/glance-wt/site/apps/site/package.json');
const sharp = require('sharp');
const source = process.argv[2];
if (!source) throw new Error('give the path of the bus photo');
const here = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

// The photo is 4740 x 3264. The yellow notice covers x 2035 to 2158, y 1190 to 1630, on the glass left of the door;
// the glass ends at y 1635 and the door frame starts at x 2160. The sticker covers the notice inside the glass, its
// rounded corner past the corner of the notice, at the size of a sticker read from a step away.
const STICKER = { left: 1812, top: 1174, width: 360 };
const height = Math.round(STICKER.width * 1560 / 1200);

const sticker = await sharp(here('assets/media/glance-sticker.png'))
  .resize(STICKER.width, height)
  // The light of the street: a little darker and less saturated than the screen colors of the drawing.
  .modulate({ brightness: 0.9, saturation: 0.8 })
  .linear(0.94, 6)
  .png()
  .toBuffer();

// A soft contact shadow, as on a sticker pressed to glass.
const shadow = await sharp({ create: { width: STICKER.width + 40, height: height + 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: { create: { width: STICKER.width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.35 } } }, left: 14, top: 26 }])
  .blur(6)
  .png()
  .toBuffer();

// The reflection of the street on the glass, faint, over the sticker.
const reflection = await sharp(source)
  .extract({ left: STICKER.left, top: STICKER.top, width: STICKER.width, height })
  .blur(6)
  .ensureAlpha(0.12)
  .png()
  .toBuffer();

const composed = await sharp(source)
  .composite([
    { input: shadow, left: STICKER.left - 20, top: STICKER.top - 20 },
    { input: sticker, left: STICKER.left, top: STICKER.top },
    { input: reflection, left: STICKER.left, top: STICKER.top, blend: 'screen' },
  ])
  .png()
  .toBuffer();

// The crop: below the destination sign and right of the TRIMET logo, the door and the panel left of it as the subject.
// The aspect is that of the full-page slot (1872 x 1032); the caption window sits over the lower quarter.
const crop = { left: 760, top: 965, width: 3380 };
crop.height = Math.round(crop.width * 1032 / 1872);
await sharp(composed)
  .extract(crop)
  .resize(1872, 1032)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(here('assets/photos/bus-door.jpg'));
console.log(`wrote assets/photos/bus-door.jpg from x ${crop.left}, y ${crop.top}, ${crop.width} x ${crop.height}`);
