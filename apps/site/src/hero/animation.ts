/*
 * The Three.js scene of the hero. HeroStage imports this module on demand, so Three.js and the GLB load after the first paint.
 * The GLB and its player are the files of assets/animation. The site frames the mark closer than example.html, with a
 * narrow field of view, renders its authored colors with no tone mapping, and plays the clip a little faster.
 */
import { AmbientLight, DirectionalLight, NoToneMapping, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { loadMetaGlanceAnimation } from '../../../../assets/animation/metaGlancePlayer.js';
import glbUrl from '../../../../assets/animation/meta-glances-placeholder.glb?url';

/*
 * example.html puts the camera 13 units away with a field of view of 45 degrees, for a full window. The hero frame is
 * smaller, so it shows a band of 3.8 units: the card at the end fills most of the frame. A narrow field of view seen from
 * farther away keeps the two loops of the mark even, as in the flat logo, where a wide one swells the near loop.
 */
const FIELD_OF_VIEW = 18;
/*
 * The band of the scene that the frame shows, in units. The mark is smaller than the card that it turns into, so the
 * camera starts closer, on the mark, and moves back to the card while the mark turns into the frame of the card.
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
// Light that shows the vertex colors close to their authored values, with soft shading on the tube.
const AMBIENT = 0.9;
const KEY = 1.1;

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
  /*
   * No tone mapping and no environment map: the blue of the mark is in its vertex colors (#3BA8F0 to #4BBDFD in sRGB)
   * and its emissive color, and tone mapping or reflections of a room turn it pale. The output is sRGB.
   */
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 200);

  scene.add(new AmbientLight(0xffffff, AMBIENT));
  const keyLight = new DirectionalLight(0xffffff, KEY);
  keyLight.position.set(2, 4, 10);
  scene.add(keyLight);

  const player = await loadMetaGlanceAnimation({ variant: 'placeholder', glbUrl, qrSource, loop: false });
  scene.add(player.root);

  const placeCamera = () => {
    const distance = visibleHeight(player.action.time) / 2 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180);
    // A narrow stage keeps the whole mark in view: the camera moves back when the stage is taller than it is wide.
    camera.position.set(0, 0, camera.aspect < 1 ? distance / camera.aspect : distance);
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    placeCamera();
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
      placeCamera();
      renderer.render(scene, camera);
    },
    dispose() {
      stopLoop();
      visibility.disconnect();
      resizeObserver.disconnect();
      player.dispose();
      renderer.dispose();
    },
  };
}
