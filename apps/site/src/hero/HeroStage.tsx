import { useReducedMotion, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { assetUrl, Picture } from '../components/Picture';
import type { HeroAnimation } from './animation';

/** poster: the still last frame. playing: the clip runs once. ended: the clip rests on its last frame. */
type Phase = 'poster' | 'loading' | 'playing' | 'ended' | 'failed';

/** The query flag of scripts/capture-poster.mjs: the stage shows the last frame on a clear background and stops. */
const isPosterCapture = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('poster');

function canAutoplay(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return hasWebGl();
}

function hasWebGl(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/** Waits for the page load and for an idle moment, so the 3D files never compete with the first paint. */
function afterLoadAndIdle(run: () => void): () => void {
  let cancelled = false;
  const runOnce = () => {
    if (!cancelled) run();
  };
  const idle = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) window.requestIdleCallback(runOnce, { timeout: 2000 });
    else setTimeout(runOnce, 300);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', idle);
  };
}

/**
 * The animation of the Meta Glance mark, which ends on a Glance code. The poster of the last frame shows first, at the
 * same size, so the animation moves no other content. Three.js loads after the page load, only when motion is
 * allowed. The clip plays once, in less than 5 seconds, and rests on its last frame, so it needs no pause control.
 * With reduced motion or Save-Data, the poster stays.
 */
export function HeroStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<HeroAnimation | null>(null);
  // One renderer for the canvas: a second start while the first one loads would draw into the same context.
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('poster');
  const posterCapture = isPosterCapture();

  const start = async () => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    setPhase('loading');
    try {
      const { startHeroAnimation } = await import('./animation');
      const animation = await startHeroAnimation({ canvas, qrSource: assetUrl('kiosk-code.png'), onEnd: () => setPhase('ended') });
      animationRef.current = animation;
      if (posterCapture) {
        // The QR texture loads after the GLB. One second is ample on a local server.
        setTimeout(() => {
          animation.seek(animation.duration);
          document.documentElement.dataset.posterReady = 'true';
        }, 1000);
        setPhase('ended');
        return;
      }
      animation.play();
      setPhase('playing');
    } catch {
      startedRef.current = false;
      setPhase('failed');
    }
  };

  // An effect event: the mount effect calls the current start without listing it, so the effect runs once.
  const startOnMount = useEffectEvent(() => void start());

  useEffect(() => {
    if (posterCapture) {
      startOnMount();
      return undefined;
    }
    if (!canAutoplay()) return undefined;
    return afterLoadAndIdle(() => startOnMount());
  }, [posterCapture]);

  useEffect(() => () => animationRef.current?.dispose(), []);

  // As the hero scrolls away, the object sinks back a little. With reduced motion it stays still. It is not a control.
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const depth = useTransform(scrollY, [0, 700], [1, 0.9]);
  const fade = useTransform(scrollY, [0, 700], [1, 0.4]);

  const showsCanvas = phase === 'playing' || phase === 'ended';

  return (
    <div className="hero-media" data-phase={phase} data-capture={posterCapture ? 'poster' : undefined}>
      <m.div className="hero-media__frame" style={reduceMotion || posterCapture ? undefined : { scale: depth, opacity: fade }}>
        <Picture
          className="hero-media__poster"
          name="hero-poster"
          widths={[480, 960, 1440]}
          sizes="(min-width: 64rem) 40rem, 80vw"
          alt="The Meta Glance mark as a card that holds a Glance code."
          width={1440}
          height={1440}
          isPriority
        />
        <canvas ref={canvasRef} className="hero-media__canvas" data-visible={showsCanvas} aria-hidden="true" />
      </m.div>
    </div>
  );
}
