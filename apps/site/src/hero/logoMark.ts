/*
 * The mark of the GLB, dressed as the logo symbol of assets/Glance Dark.svg.
 *
 * The tube of the GLB, in its "front" pose and seen straight on, has the outline of the symbol: its radius swells and
 * thins as the stroke of the symbol does. Its authored material is a light sky blue with soft shading, which the symbol
 * is not. scripts/build-mark-colors.mjs gives each vertex the color of the symbol where it shows in that view; this
 * module draws the tube with those colors, unlit, so the mark that faces the viewer has the colors of the logo.
 *
 * Three more corrections, bound to the time of the clip:
 * - The stroke. The other poses of the tube (the turn, the unfold) have one radius all along. Each vertex keeps the ratio
 *   of its distance to the centre of its ring in the front pose, so the stroke swells and thins in every pose, until
 *   the tube becomes the even frame of the card.
 * - The half turn. The clip turns the mark half a turn about its vertical axis, so at its second hold the viewer would see
 *   the back of the front pose: the symbol mirrored, with the swell of the stroke on the wrong side. While the mark is
 *   edge on and has no morph (0.58 s to 1 s of the clip), the tube is the same after half a turn about its own vertical
 *   axis, so the mesh turns half a turn there. Each vertex then lands where its partner was, so its color and stroke
 *   fade to those of its partner before the turn and back to its own after it: no frame shows the turn.
 * - Relief. While the mark turns and unfolds, a soft light on the normals shows its depth. At the two holds that face the
 *   viewer, and at the end, the relief is zero: the colors are the colors of the logo, flat.
 */
import { BufferAttribute, type BufferGeometry, type Mesh, type Object3D, ShaderMaterial } from 'three';

// Seconds of the clip.
const HALF_TURN_AT = 0.8;
const SWAP_START = 0.59;
const SWAP_END = 0.99;

/** [time, value] keys, eased between them. */
type Keys = ReadonlyArray<readonly [number, number]>;

/** The strength of the relief. */
const RELIEF: Keys = [
  [0.15, 0],
  [0.45, 1],
  [1.45, 1],
  [1.88, 0],
  [2.22, 0],
  [2.55, 1],
  [3.55, 1],
  [3.95, 0],
];

/** How much of the stroke of the symbol the tube keeps away from the front pose: all of it, until it becomes the frame. */
const STROKE: Keys = [
  [3.15, 1],
  [3.7, 0],
];

// The order of the morph targets in the GLB.
const TARGETS = ['front', 'unfold_1', 'unfold_2', 'target_frame'] as const;

const smooth = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
};

function at(keys: Keys, time: number): number {
  let previous = keys[0];
  if (!previous) return 0;
  if (time <= previous[0]) return previous[1];
  for (const key of keys.slice(1)) {
    if (time <= key[0]) return previous[1] + (key[1] - previous[1]) * smooth((time - previous[0]) / (key[0] - previous[0]));
    previous = key;
  }
  return previous[1];
}

/** 0: the own color and stroke of each vertex. 0.5 at the half turn: the mean of the two partners, the same before and after it. */
function swap(time: number): number {
  if (time < HALF_TURN_AT) return 0.5 * smooth((time - SWAP_START) / (HALF_TURN_AT - SWAP_START));
  return 0.5 * (1 - smooth((time - HALF_TURN_AT) / (SWAP_END - HALF_TURN_AT)));
}

const vertexShader = /* glsl */ `
#include <common>
#include <morphtarget_pars_vertex>
attribute vec3 logoColor;
attribute vec3 partnerColor;
attribute vec2 strokeScale;
attribute vec3 ringCentre;
attribute vec3 centreFront;
attribute vec3 centreUnfold1;
attribute vec3 centreUnfold2;
attribute vec3 centreFrame;
uniform vec4 weights;
uniform float swap;
uniform float stroke;
varying vec3 vColor;
varying vec3 vNormalView;
void main() {
  vColor = mix(logoColor, partnerColor, swap);
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  vNormalView = transformedNormal;
  #include <begin_vertex>
  #include <morphtarget_vertex>
  vec3 centre = ringCentre + weights.x * centreFront + weights.y * centreUnfold1 + weights.z * centreUnfold2 + weights.w * centreFrame;
  float scale = mix(strokeScale.x, strokeScale.y, swap);
  transformed = centre + (transformed - centre) * (1.0 + (scale - 1.0) * (1.0 - weights.x) * stroke);
  #include <project_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float relief;
varying vec3 vColor;
varying vec3 vNormalView;
void main() {
  vec3 n = normalize(vNormalView);
  float light = max(dot(n, normalize(vec3(0.35, 0.55, 1.0))), 0.0);
  float shade = 1.0 - relief * 0.38 * (1.0 - light);
  gl_FragColor = vec4(vColor * shade, 1.0);
  #include <colorspace_fragment>
}
`;

function srgbToLinear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** The rings of the tube: u of the texture coordinates runs along the tube, one value per ring. */
function ringsOf(geometry: BufferGeometry): { ring: Int32Array; rings: number } {
  const uv = geometry.getAttribute('uv');
  const count = uv.count;
  const us = [...new Set(Array.from({ length: count }, (_, i) => uv.getX(i)))].sort((a, b) => a - b);
  const index = new Map(us.map((u, k) => [u, k]));
  // The last ring repeats the first: the tube is a closed loop.
  return { ring: Int32Array.from({ length: count }, (_, i) => (index.get(uv.getX(i)) ?? 0) % (us.length - 1)), rings: us.length - 1 };
}

/** The centre of each ring, per vertex, for positions given as a flat array. */
function centres(positions: Float32Array, ring: Int32Array, rings: number): Float32Array {
  const sum = new Float64Array(rings * 3);
  const n = new Float64Array(rings);
  for (let i = 0; i < ring.length; i += 1) {
    const r = ring[i] ?? 0;
    for (let c = 0; c < 3; c += 1) sum[r * 3 + c] = (sum[r * 3 + c] ?? 0) + (positions[i * 3 + c] ?? 0);
    n[r] = (n[r] ?? 0) + 1;
  }
  const out = new Float32Array(ring.length * 3);
  for (let i = 0; i < ring.length; i += 1) {
    const r = ring[i] ?? 0;
    for (let c = 0; c < 3; c += 1) out[i * 3 + c] = (sum[r * 3 + c] ?? 0) / (n[r] || 1);
  }
  return out;
}

export type LogoMark = {
  /** Sets the half turn, the colors, the stroke, and the relief for a time of the clip, in seconds. */
  update(clipTime: number): void;
  dispose(): void;
};

/**
 * Dresses the mark of the clip with mark-colors.bin (see scripts/build-mark-colors.mjs). Returns null, and leaves the
 * authored mark, when the file does not fit the mesh.
 */
export function dressLogoMark(root: Object3D, file: Uint8Array): LogoMark | null {
  const mesh = root.getObjectByName('MetaLogo_Morph') as Mesh | undefined;
  const geometry = mesh?.geometry;
  const morphs = geometry?.morphAttributes.position;
  const count = geometry?.getAttribute('position')?.count ?? 0;
  if (!mesh || !geometry || !morphs || morphs.length !== TARGETS.length || count === 0 || file.length !== count * 5) return null;

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const partner = Uint32Array.from({ length: count }, (_, i) => view.getUint16(i * 2, true));
  const bytes = file.subarray(count * 2);

  const own = new Float32Array(count * 3);
  const theirs = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const j = partner[i] ?? i;
    for (let c = 0; c < 3; c += 1) {
      own[i * 3 + c] = srgbToLinear(bytes[i * 3 + c] ?? 0);
      theirs[i * 3 + c] = srgbToLinear(bytes[j * 3 + c] ?? 0);
    }
  }

  // Ring centres of the base and of each target (as offsets, like the targets), and the stroke of the front pose.
  const { ring, rings } = ringsOf(geometry);
  const base = Float32Array.from(geometry.getAttribute('position').array);
  const baseCentres = centres(base, ring, rings);
  const targetCentres = morphs.map((target) => {
    const posed = Float32Array.from(base, (value, k) => value + target.getComponent(Math.floor(k / 3), k % 3));
    const posedCentres = centres(posed, ring, rings);
    return { posed, offsets: Float32Array.from(posedCentres, (value, k) => value - (baseCentres[k] ?? 0)), posedCentres };
  });
  const front = targetCentres[0];
  if (!front) return null;
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const d = (array: Float32Array, centre: Float32Array) =>
      Math.hypot((array[i * 3] ?? 0) - (centre[i * 3] ?? 0), (array[i * 3 + 1] ?? 0) - (centre[i * 3 + 1] ?? 0), (array[i * 3 + 2] ?? 0) - (centre[i * 3 + 2] ?? 0));
    const radius = d(base, baseCentres);
    scale[i] = radius > 1e-6 ? d(front.posed, front.posedCentres) / radius : 1;
  }
  const strokeScale = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    strokeScale[i * 2] = scale[i] ?? 1;
    strokeScale[i * 2 + 1] = scale[partner[i] ?? i] ?? 1;
  }

  geometry.setAttribute('logoColor', new BufferAttribute(own, 3));
  geometry.setAttribute('partnerColor', new BufferAttribute(theirs, 3));
  geometry.setAttribute('strokeScale', new BufferAttribute(strokeScale, 2));
  geometry.setAttribute('ringCentre', new BufferAttribute(baseCentres, 3));
  const centreNames = ['centreFront', 'centreUnfold1', 'centreUnfold2', 'centreFrame'] as const;
  targetCentres.forEach(({ offsets }, k) => geometry.setAttribute(centreNames[k] ?? `centre${k}`, new BufferAttribute(offsets, 3)));

  const influences = mesh.morphTargetInfluences ?? [];
  const order = TARGETS.map((name) => mesh.morphTargetDictionary?.[name] ?? -1);
  const authored = mesh.material;
  const material = new ShaderMaterial({
    uniforms: { weights: { value: [0, 0, 0, 0] }, swap: { value: 0 }, stroke: { value: 1 }, relief: { value: 0 } },
    vertexShader,
    fragmentShader,
  });
  mesh.material = material;
  if (!Array.isArray(authored)) authored.dispose();

  return {
    update(clipTime) {
      mesh.rotation.y = clipTime >= HALF_TURN_AT ? Math.PI : 0;
      const { uniforms } = material;
      if (uniforms.weights) uniforms.weights.value = order.map((index) => influences[index] ?? 0);
      if (uniforms.swap) uniforms.swap.value = swap(clipTime);
      if (uniforms.stroke) uniforms.stroke.value = at(STROKE, clipTime);
      if (uniforms.relief) uniforms.relief.value = at(RELIEF, clipTime);
    },
    dispose() {
      material.dispose();
    },
  };
}
