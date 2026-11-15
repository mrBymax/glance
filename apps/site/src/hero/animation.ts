/*
 * The Three.js scene of the hero. HeroStage imports this module on demand, so Three.js and the GLB load after the first paint.
 * The GLB and its player are the files of assets/animation. The site frames the mark closer than example.html, draws the
 * mark with the colors of the logo symbol (src/hero/logoMark.ts), and plays the clip a little faster.
 */
import { NoToneMapping, OrthographicCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { loadMetaGlanceAnimation } from '../../../../assets/animation/metaGlancePlayer.js';
import glbUrl from '../../../../assets/animation/meta-glances-placeholder.glb?url';
import markColorsUrl from '../assets/generated/mark-colors.bin?url';
import { dressLogoMark } from './logoMark';

/*
 * example.html puts a perspective camera 13 units away. The tube of the mark is deep: its two loops lie up to 0.9 units
 * apart front to back, so a camera with perspective draws the near loop larger and tilts the symbol. The hero uses an
 * orthographic camera: the mark that faces the viewer has the outline of the flat logo, loop for loop.
 */
/*
 * The band of the scene that the frame shows, in units. The mark is smaller than the card that it turns into, so the
 * view starts close, on the mark, and widens to the card while the mark turns into the frame of the card.
 */
const MARK_HEIGHT = 2.4;
const CARD_HEIGHT = 3.8;
const MOVE_START = 2.2;
const MOVE_END = 3.4;

function visibleHeight(clipTime: number): number {
  const t = Math.min(Math.max((clipTime - MOVE_START) / (MOVE_END - MOVE_START), 0), 1);
  const eased = t * t * (3 - 2 * t);
  return MARK_HEIGHT + (CARD_HEIGHT - MARK_HEIGHT) * eased;
}
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
  // No tone mapping: the colors of the mark are the sRGB colors of the logo, and the card is white.
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  camera.position.set(0, 0, 13);
  let aspect = 1;

  // The card and the subtitle are emissive, and the mark is unlit, so the scene needs no light.
  const [player, markColors] = await Promise.all([
    loadMetaGlanceAnimation({ variant: 'placeholder', glbUrl, qrSource, loop: false }),
    fetch(markColorsUrl).then(async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : null)),
  ]);
  scene.add(player.root);
  const mark = markColors ? dressLogoMark(player.root, markColors) : null;
  const pose = () => mark?.update(player.action.time);
  pose();

  const placeCamera = () => {
    // A narrow stage keeps the whole band in view: when the stage is taller than it is wide, the band sets the width.
    const height = visibleHeight(player.action.time) / Math.min(aspect, 1);
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.left = (-height * aspect) / 2;
    camera.right = (height * aspect) / 2;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    aspect = clientWidth / clientHeight;
    placeCamera();
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
    pose();
    placeCamera();
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
      pose();
      placeCamera();
      renderer.render(scene, camera);
    },
    dispose() {
      stopLoop();
      visibility.disconnect();
      resizeObserver.disconnect();
      mark?.dispose();
      player.dispose();
      renderer.dispose();
    },
  };
}
