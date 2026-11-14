/*
 * The Three.js scene of the hero. HeroStage imports this module on demand, so Three.js and the GLB load after the first paint.
 * The scene settings come from assets/animation/example.html: the camera, the lights, and the tone mapping.
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { loadMetaGlanceAnimation } from '../../../../assets/animation/metaGlancePlayer.js';
import glbUrl from '../../../../assets/animation/meta-glances-placeholder.glb?url';

/*
 * example.html puts the camera 13 units away, for a full window. The card at the end of the clip then fills a fifth of
 * the height. The hero frame is smaller, so the camera moves closer until the card fills most of the frame.
 */
const CAMERA_DISTANCE = 4.4;

export type HeroAnimation = {
  /** Length of the clip in seconds. */
  duration: number;
  play(): void;
  pause(): void;
  restart(): void;
  /** Shows one time of the clip and stops. The poster script uses it for the last frame. */
  seek(seconds: number): void;
  dispose(): void;
};

export type HeroAnimationOptions = {
  canvas: HTMLCanvasElement;
  /** The image on the card at the end of the clip, with its white margin. */
  qrSource: HTMLCanvasElement | HTMLImageElement | string;
  onEnd: () => void;
};

export async function startHeroAnimation({ canvas, qrSource, onEnd }: HeroAnimationOptions): Promise<HeroAnimation> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  scene.add(new AmbientLight(0xffffff, 0.95));
  const keyLight = new DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(5, 8, 10);
  scene.add(keyLight);
  const rimLight = new DirectionalLight(0x88b8ff, 0.75);
  rimLight.position.set(-6, -4, 6);
  scene.add(rimLight);

  const player = await loadMetaGlanceAnimation({ variant: 'placeholder', glbUrl, qrSource, loop: false });
  scene.add(player.root);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    // A narrow stage keeps the whole mark in view: the camera moves back when the stage is taller than it is wide.
    camera.position.z = camera.aspect < 1 ? CAMERA_DISTANCE / camera.aspect : CAMERA_DISTANCE;
    camera.updateProjectionMatrix();
    // A new size clears the canvas. After the end or a pause no loop draws again, so this draws the frame once.
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  // The time of the last frame, in milliseconds. Null while the clip does not play, so a pause does not count.
  let last: number | null = null;
  let ended = false;
  const frame = (now: number) => {
    const delta = last === null ? 0 : (now - last) / 1000;
    last = now;
    player.update(delta);
    renderer.render(scene, camera);
    if (!ended && player.action.time >= player.duration) {
      ended = true;
      renderer.setAnimationLoop(null);
      onEnd();
    }
  };

  return {
    duration: player.duration,
    play() {
      last = null;
      renderer.setAnimationLoop(frame);
    },
    pause() {
      renderer.setAnimationLoop(null);
    },
    restart() {
      ended = false;
      last = null;
      player.restart();
      renderer.setAnimationLoop(frame);
    },
    seek(seconds) {
      renderer.setAnimationLoop(null);
      player.seek(seconds);
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      player.dispose();
      renderer.dispose();
    },
  };
}
