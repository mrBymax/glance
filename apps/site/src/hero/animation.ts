/*
 * The Three.js scene of the hero. HeroStage imports this module on demand, so Three.js and the GLB load after the first paint.
 * The camera, the lights, and the tone mapping start from assets/animation/example.html. The site adds a studio
 * environment for reflections, a closer camera, and a faster clip.
 */
import {
  AmbientLight,
  DirectionalLight,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadMetaGlanceAnimation } from '../../../../assets/animation/metaGlancePlayer.js';
import glbUrl from '../../../../assets/animation/meta-glances-placeholder.glb?url';

/*
 * example.html puts the camera 13 units away, for a full window. The card at the end of the clip then fills a fifth of
 * the height. The hero frame is smaller, so the camera moves closer until the card fills most of the frame.
 */
const CAMERA_DISTANCE = 4.6;
/*
 * The clip lasts 6 seconds. At 1.25 times its speed it lasts 4.8 seconds, under the 5 seconds after which WCAG 2.2.2
 * asks for a pause control. It then rests on its last frame.
 */
const SPEED = 1.25;

export type HeroAnimation = {
  /** Length of the clip in seconds, at its own speed. */
  duration: number;
  play(): void;
  /** Shows one time of the clip and stops. The poster script uses it for the last frame. */
  seek(seconds: number): void;
  dispose(): void;
};

export type HeroAnimationOptions = {
  canvas: HTMLCanvasElement;
  /** The image on the card at the end of the clip, with its quiet zone. */
  qrSource: HTMLCanvasElement | HTMLImageElement | string;
  onEnd: () => void;
};

export async function startHeroAnimation({ canvas, qrSource, onEnd }: HeroAnimationOptions): Promise<HeroAnimation> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Neutral tone mapping keeps the blue of the mark and the white of the card. ACES of example.html greys them.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  pmrem.dispose();

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  scene.add(new AmbientLight(0xffffff, 0.45));
  const keyLight = new DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(4, 6, 8);
  scene.add(keyLight);
  const rimLight = new DirectionalLight(0x9cc3ff, 0.9);
  rimLight.position.set(-6, -3, 4);
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
    // A new size clears the canvas. After the end no loop draws again, so this draws the frame once.
    renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  let isPlaying = false;
  let isVisible = true;
  // The time of the last frame, in milliseconds. Null after a stop, so the time out of view does not count.
  let last: number | null = null;

  const stopLoop = () => renderer.setAnimationLoop(null);
  const frame = (now: number) => {
    const delta = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    player.update(delta * SPEED);
    renderer.render(scene, camera);
    if (player.action.time >= player.duration) {
      isPlaying = false;
      stopLoop();
      onEnd();
    }
  };
  const startLoop = () => {
    last = null;
    if (isVisible && isPlaying) renderer.setAnimationLoop(frame);
  };

  // No frame is drawn while the hero is out of view. The clip goes on from there when it comes back.
  const visibility = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;
    if (isVisible) startLoop();
    else stopLoop();
  });
  visibility.observe(canvas);

  return {
    duration: player.duration,
    play() {
      isPlaying = true;
      startLoop();
    },
    seek(seconds) {
      isPlaying = false;
      stopLoop();
      player.seek(seconds);
      renderer.render(scene, camera);
    },
    dispose() {
      stopLoop();
      visibility.disconnect();
      resizeObserver.disconnect();
      environment.dispose();
      player.dispose();
      renderer.dispose();
    },
  };
}
