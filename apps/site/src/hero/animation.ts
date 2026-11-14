/*
 * The Three.js scene of the hero. HeroStage imports this module on demand, so Three.js and the GLB load after the first paint.
 * The camera, the lights, and the tone mapping start from assets/animation/example.html. The site adds a studio
 * environment for reflections, a closer camera, and a calm hold after the clip.
 */
import {
  AmbientLight,
  DirectionalLight,
  Group,
  MathUtils,
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
// The hold after the clip: a slow sway, in radians and units, and the tilt toward the pointer.
const SWAY = { yaw: 0.07, pitch: 0.03, lift: 0.03, speed: 0.45 };
const TILT = { yaw: 0.22, pitch: 0.14, ease: 0.06 };

export type HeroAnimation = {
  /** Length of the clip in seconds. */
  duration: number;
  /** Plays the clip from where it stopped. After the end, it plays the hold. */
  play(): void;
  pause(): void;
  restart(): void;
  /** Shows one time of the clip and stops. The poster script uses it for the last frame. */
  seek(seconds: number): void;
  dispose(): void;
};

export type HeroAnimationOptions = {
  canvas: HTMLCanvasElement;
  /** The image on the card at the end of the clip, with its quiet zone. */
  qrSource: HTMLCanvasElement | HTMLImageElement | string;
  /** False with reduced motion: the clip then stops on its last frame, with no sway and no tilt. */
  hasIdleMotion: boolean;
  onEnd: () => void;
};

export async function startHeroAnimation({ canvas, qrSource, hasIdleMotion, onEnd }: HeroAnimationOptions): Promise<HeroAnimation> {
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
  // The sway and the tilt turn this group. The clip animates the nodes inside it.
  const stage = new Group();
  stage.add(player.root);
  scene.add(stage);

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
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const pointer = { x: 0, y: 0 };
  const onPointer = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointer.x = MathUtils.clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1);
    pointer.y = MathUtils.clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1);
  };
  const tiltsWithPointer = hasIdleMotion && window.matchMedia('(pointer: fine)').matches;
  if (tiltsWithPointer) window.addEventListener('pointermove', onPointer, { passive: true });

  let mode: 'clip' | 'hold' | 'stopped' = 'stopped';
  let ended = false;
  let isVisible = true;
  // The time of the last frame, in milliseconds. Null after a stop, so a pause does not count as time.
  let last: number | null = null;
  let holdTime = 0;

  const frame = (now: number) => {
    const delta = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    if (mode === 'clip') {
      player.update(delta);
      if (!ended && player.action.time >= player.duration) {
        ended = true;
        onEnd();
        if (!hasIdleMotion) {
          renderer.render(scene, camera);
          stopLoop();
          mode = 'stopped';
          return;
        }
        mode = 'hold';
      }
    }
    // The hold eases in from the last frame of the clip, so the card never jumps.
    const weight = mode === 'hold' ? Math.min(holdTime / 1.5, 1) : 0;
    if (mode === 'hold') holdTime += delta;
    const swayYaw = Math.sin(holdTime * SWAY.speed) * SWAY.yaw * weight;
    const swayPitch = Math.sin(holdTime * SWAY.speed * 0.7) * SWAY.pitch * weight;
    stage.rotation.y = MathUtils.lerp(stage.rotation.y, swayYaw + pointer.x * TILT.yaw * weight, TILT.ease);
    stage.rotation.x = MathUtils.lerp(stage.rotation.x, swayPitch + pointer.y * TILT.pitch * weight, TILT.ease);
    stage.position.y = Math.sin(holdTime * SWAY.speed * 1.3) * SWAY.lift * weight;
    renderer.render(scene, camera);
  };

  const startLoop = () => {
    last = null;
    if (isVisible) renderer.setAnimationLoop(frame);
  };
  const stopLoop = () => renderer.setAnimationLoop(null);

  // No frame is drawn while the hero is out of view.
  const visibility = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;
    if (!isVisible) stopLoop();
    else if (mode !== 'stopped') startLoop();
  });
  visibility.observe(canvas);

  return {
    duration: player.duration,
    play() {
      mode = ended ? (hasIdleMotion ? 'hold' : 'stopped') : 'clip';
      if (mode !== 'stopped') startLoop();
    },
    pause() {
      mode = 'stopped';
      stopLoop();
    },
    restart() {
      ended = false;
      holdTime = 0;
      stage.rotation.set(0, 0, 0);
      stage.position.set(0, 0, 0);
      player.restart();
      mode = 'clip';
      startLoop();
    },
    seek(seconds) {
      mode = 'stopped';
      stopLoop();
      player.seek(seconds);
      renderer.render(scene, camera);
    },
    dispose() {
      stopLoop();
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointer);
      environment.dispose();
      player.dispose();
      renderer.dispose();
    },
  };
}
