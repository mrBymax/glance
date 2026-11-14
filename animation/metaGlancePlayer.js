import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const GLANCE_VARIANTS = {
  placeholder: new URL('./meta-glances-placeholder.glb', import.meta.url).href,
  'circle-placeholder': new URL('./meta-glances-circle-placeholder.glb', import.meta.url).href,
  frame: new URL('./meta-glances-frame.glb', import.meta.url).href,
  'circle-frame': new URL('./meta-glances-circle-frame.glb', import.meta.url).href,
};

/**
 * Configure a Three.js Texture for `Placeholder_Card`.
 *
 * The card material reads color from Emission Color (baseColorFactor RGB is 0)
 * and uses glTF top-down UVs (v = 0 at the top), so `flipY = false` keeps QR
 * codes right-side up.
 */
function configureQrTexture(texture) {
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Replace the image on `Placeholder_Card` at runtime (no Blender rebuild).
 *
 * @param {THREE.Object3D} root
 * @param {THREE.Texture | HTMLCanvasElement | HTMLImageElement | string} source
 * @returns {THREE.Mesh | null}
 */
export function setPlaceholderQrTexture(root, source) {
  const cardMesh = root.getObjectByName('Placeholder_Card');
  if (!cardMesh || !cardMesh.material) return null;

  let texture;
  if (source?.isTexture) {
    texture = configureQrTexture(source);
  } else if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
    texture = configureQrTexture(new THREE.Texture(source));
  } else if (typeof source === 'string') {
    texture = configureQrTexture(new THREE.TextureLoader().load(source));
  } else {
    throw new TypeError('Unsupported QR texture source');
  }

  const prevMap = cardMesh.material.emissiveMap;
  cardMesh.material.emissive = new THREE.Color(0xffffff);
  cardMesh.material.emissiveIntensity = 1.0;
  cardMesh.material.emissiveMap = texture;
  cardMesh.material.needsUpdate = true;
  if (prevMap && prevMap !== texture) prevMap.dispose();

  return cardMesh;
}

/*
 * Three.js GLTFLoader ignores KHR_animation_pointer channels, so we read any
 * baseColorFactor tracks directly and interpolate alpha each frame.
 */
async function extractOpacityTracks(gltf, materialsByIndex) {
  const tracks = [];
  const animations = gltf.parser.json.animations || [];

  for (const anim of animations) {
    for (const channel of anim.channels) {
      const pointer = channel.target.extensions?.KHR_animation_pointer?.pointer || '';
      const match = pointer.match(/^\/materials\/(\d+)\/pbrMetallicRoughness\/baseColorFactor$/);
      if (!match) continue;

      const mats = materialsByIndex[match[1]];
      if (!mats) continue;

      const sampler = anim.samplers[channel.sampler];
      const [inputAcc, outputAcc] = await Promise.all([
        gltf.parser.getDependency('accessor', sampler.input),
        gltf.parser.getDependency('accessor', sampler.output),
      ]);
      tracks.push({ times: inputAcc.array, values: outputAcc.array, mats });
    }
  }
  return tracks;
}

function sampleTrackAlpha(track, time) {
  const ts = track.times;
  const n = ts.length;
  if (time <= ts[0]) return track.values[3];
  if (time >= ts[n - 1]) return track.values[(n - 1) * 4 + 3];

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= time) lo = mid;
    else hi = mid;
  }
  const k = (time - ts[lo]) / (ts[hi] - ts[lo]);
  return track.values[lo * 4 + 3] * (1 - k) + track.values[hi * 4 + 3] * k;
}

/**
 * Load a Meta Glance GLB, bind an initial QR source if present, and set up fades.
 *
 * @param {object} [params]
 * @param {'placeholder'|'circle-placeholder'|'frame'|'circle-frame'} [params.variant='placeholder']
 * @param {string} [params.glbUrl] Override URL for the GLB resolved from `variant`
 * @param {THREE.Texture | HTMLCanvasElement | HTMLImageElement | string} [params.qrSource]
 * @param {boolean} [params.loop=false]
 */
export async function loadMetaGlanceAnimation({
  variant = 'placeholder',
  glbUrl = GLANCE_VARIANTS[variant] || GLANCE_VARIANTS.placeholder,
  qrSource = null,
  loop = false,
} = {}) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(glbUrl);
  const root = gltf.scene;

  const materialsByIndex = {};
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const assoc = gltf.parser.associations.get(child.material);
    const matIdx = assoc ? assoc.materials : undefined;
    child.material = child.material.clone();
    if (child.material.transparent) {
      child.material.depthWrite = false;
    }
    if (matIdx !== undefined) {
      (materialsByIndex[matIdx] ||= []).push(child.material);
    }
  });

  if (qrSource) {
    setPlaceholderQrTexture(root, qrSource);
  }

  const opacityTracks = await extractOpacityTracks(gltf, materialsByIndex);
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
  action.clampWhenFinished = true;
  action.play();

  function applyOpacity(time) {
    for (const track of opacityTracks) {
      const alpha = sampleTrackAlpha(track, time);
      for (const mat of track.mats) {
        mat.transparent = true;
        mat.opacity = alpha;
        mat.depthWrite = alpha > 0.99;
        mat.visible = alpha > 0.002;
      }
    }
  }

  applyOpacity(0);

  return {
    root,
    mixer,
    action,
    duration: clip.duration,
    setQr(source) {
      return setPlaceholderQrTexture(root, source);
    },
    update(deltaSeconds) {
      mixer.update(deltaSeconds);
      const t = loop ? (action.time % clip.duration) : Math.min(action.time, clip.duration);
      applyOpacity(t);
    },
    seek(timeSeconds) {
      action.time = Math.max(0, Math.min(timeSeconds, clip.duration));
      mixer.update(0);
      applyOpacity(action.time);
    },
    restart() {
      action.reset();
      action.play();
      applyOpacity(0);
    },
    dispose() {
      mixer.stopAllAction();
      root.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          mat?.map?.dispose();
          mat?.emissiveMap?.dispose();
          mat?.dispose();
        }
      });
    },
  };
}

