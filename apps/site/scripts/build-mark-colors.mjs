// Writes src/assets/generated/mark-colors.bin: the colors of the logo symbol for each vertex of the mark in the GLB.
// Run it after a change of assets/animation/meta-glances-placeholder.glb or of the symbol in assets/Glance Dark.svg:
//   node scripts/build-mark-colors.mjs
//
// The tube of the GLB, in its "front" pose and seen straight on, has the outline of the logo symbol: 513 rings of 49
// vertices, whose radius swells and thins as the stroke of the symbol does. This script gives each vertex the color of
// the symbol at the place where it shows in that view, so the mark wears the gradient of the logo, and the gradient
// travels with the tube when it turns and unfolds.
//
// The file holds, for each vertex, first the index of the vertex that sits at its place once the mesh with no morph has
// turned half a turn about its vertical axis (uint16, little endian), then, after all indices, the color of each vertex
// (3 sRGB bytes). src/hero/logoMark.ts turns the mesh half a turn while the mark is seen edge on, so that the mark faces
// the viewer the right way round at the end of its turn, and fades each vertex to the color and the stroke of its
// partner around that moment (see "the half turn" there).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repo = (path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const out = (path) => fileURLToPath(new URL(`../src/assets/generated/${path}`, import.meta.url));

// ---- The GLB: positions, texture coordinates, and the "front" morph target of the mark.
const glb = await readFile(repo('assets/animation/meta-glances-placeholder.glb'));
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;

function accessor(index) {
  const a = gltf.accessors[index];
  const view = gltf.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const offset = binStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const values = new Float32Array(a.count * size);
  for (let i = 0; i < values.length; i += 1) values[i] = glb.readFloatLE(offset + i * 4);
  return values;
}

const mesh = gltf.meshes.find((m) => m.name === 'meta_logo.PoseMorph');
const primitive = mesh.primitives[0];
const targetNames = mesh.extras.targetNames;
const position = accessor(primitive.attributes.POSITION);
const uv = accessor(primitive.attributes.TEXCOORD_0);
const front = accessor(primitive.targets[targetNames.indexOf('front')].POSITION);
const count = position.length / 3;

// u runs along the tube (one value per ring), v around it.
const us = [...new Set(Array.from({ length: count }, (_, i) => uv[i * 2]))].sort((a, b) => a - b);
const ringOf = new Map(us.map((u, k) => [u, k]));
const rings = us.length - 1; // the last ring repeats the first: the tube is a closed loop
const ring = Int32Array.from({ length: count }, (_, i) => ringOf.get(uv[i * 2]));

// ---- The symbol of the logo, alone, from the dark logo (the hero is a dark stage). Its outline spans x 567.69 to
// 2072.93 and y 1000 to 2000 in the units of the file.
const SYMBOL = { x: 567.69, y: 1000, width: 1505.24, height: 1000 };
const WIDTH = 3010;
const HEIGHT = Math.round((WIDTH * SYMBOL.height) / SYMBOL.width);
const source = await readFile(repo('assets/Glance Dark.svg'), 'utf8');
let symbol = source.replace(/<g id="Artboard_outline"[\s\S]*?<\/g>\s*/, '');
symbol = symbol.replace(/(<g id="Symbol">\s*)<g>[\s\S]*?<\/g>/, '$1'); // the wordmark
symbol = symbol.replace(/viewBox="[^"]*"/, `viewBox="${SYMBOL.x} ${SYMBOL.y} ${SYMBOL.width} ${SYMBOL.height}"`);
// The fill of the symbol is a PNG clipped to its outline. Near the crossing a path with a linear gradient lies on it:
// the strand that passes in front. The strand behind takes the fill alone.
const withOverlay = symbol;
const fillOnly = symbol.replace(/<path class="cls-4"[^>]*\/>/, '');

async function pixels(svg) {
  const { data } = await sharp(Buffer.from(svg), { density: (72 * WIDTH) / SYMBOL.width })
    .resize(WIDTH, HEIGHT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return bleed(data);
}

// Colors outside the outline take the color of the nearest pixel inside it, so a vertex on the very edge of the tube
// samples the edge color of the symbol, not the background.
function bleed(rgba) {
  const rgb = new Uint8Array(WIDTH * HEIGHT * 3);
  const known = new Uint8Array(WIDTH * HEIGHT);
  let queue = [];
  for (let k = 0; k < WIDTH * HEIGHT; k += 1) {
    if (rgba[k * 4 + 3] >= 250) {
      rgb.set(rgba.subarray(k * 4, k * 4 + 3), k * 3);
      known[k] = 1;
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const next = [];
    for (const k of queue) {
      const x = k % WIDTH;
      const y = (k - x) / WIDTH;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
        const n = ny * WIDTH + nx;
        if (known[n]) continue;
        known[n] = 1;
        rgb.copyWithin(n * 3, k * 3, k * 3 + 3);
        next.push(n);
      }
    }
    queue = next;
  }
  return rgb;
}

const imageFront = await pixels(withOverlay);
const imageBehind = await pixels(fillOnly);

// ---- The front pose seen straight on: its outline box is the box of the symbol.
const pose = new Float32Array(count * 3);
for (let i = 0; i < pose.length; i += 1) pose[i] = position[i] + front[i];
let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
for (let i = 0; i < count; i += 1) {
  minX = Math.min(minX, pose[i * 3]);
  maxX = Math.max(maxX, pose[i * 3]);
  minY = Math.min(minY, pose[i * 3 + 1]);
  maxY = Math.max(maxY, pose[i * 3 + 1]);
}

function sample(image, x, y) {
  const fx = Math.min(Math.max(x, 0), WIDTH - 1.001);
  const fy = Math.min(Math.max(y, 0), HEIGHT - 1.001);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (xx, yy, c) => image[(yy * WIDTH + xx) * 3 + c];
  return [0, 1, 2].map((c) =>
    Math.round(
      at(x0, y0, c) * (1 - tx) * (1 - ty) + at(x0 + 1, y0, c) * tx * (1 - ty) + at(x0, y0 + 1, c) * (1 - tx) * ty + at(x0 + 1, y0 + 1, c) * tx * ty,
    ),
  );
}

// The strand in front at the crossing is the half of the loop around ring 256 (it passes nearest the viewer there).
const isFrontStrand = (r) => r >= rings / 4 && r <= (rings * 3) / 4;

const file = new Uint8Array(count * 5);
const partner = new DataView(file.buffer, 0, count * 2);
const colors = file.subarray(count * 2);
for (let i = 0; i < count; i += 1) {
  const x = ((pose[i * 3] - minX) / (maxX - minX)) * WIDTH;
  const y = ((maxY - pose[i * 3 + 1]) / (maxY - minY)) * HEIGHT;
  colors.set(sample(isFrontStrand(ring[i]) ? imageFront : imageBehind, x, y), i * 3);
}

// ---- The half turn: the mesh with no morph is the same after half a turn about y. For each vertex, the vertex at the
// place where it lands.
const ringVertices = Array.from({ length: rings + 1 }, () => []);
for (let i = 0; i < count; i += 1) ringVertices[ring[i]].push(i);
let worst = 0;
for (let i = 0; i < count; i += 1) {
  const tx = -position[i * 3];
  const ty = position[i * 3 + 1];
  const tz = -position[i * 3 + 2];
  const opposite = (ring[i] + rings / 2) % rings;
  let best = Infinity;
  let match = i;
  for (let dr = -2; dr <= 2; dr += 1) {
    for (const j of ringVertices[(opposite + dr + rings) % rings]) {
      const d = Math.hypot(position[j * 3] - tx, position[j * 3 + 1] - ty, position[j * 3 + 2] - tz);
      if (d < best) {
        best = d;
        match = j;
      }
    }
  }
  worst = Math.max(worst, best);
  partner.setUint16(i * 2, match, true);
}

await writeFile(out('mark-colors.bin'), file);
console.log(`wrote mark-colors.bin: ${count} vertices, ${rings} rings; the half turn moves no vertex more than ${worst.toExponential(2)} units`);
