import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useReducedMotion, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { assetUrl, Picture } from '../components/Picture';
import type { HeroAnimation } from './animation';

/** playing: the clip runs. holding: the clip has ended and the card sways. ended: the card stands still on its last frame. */
type Phase = 'poster' | 'loading' | 'playing' | 'holding' | 'paused' | 'ended' | 'failed';

/** The query flag of scripts/capture-poster.mjs: the stage shows the last frame on a clear background and stops. */
const isPosterCapture = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('poster');

const prefersLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function canAutoplay(): boolean {
  if (prefersLessMotion()) return false;
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
 * The animation of the Meta Glance mark. The static poster shows first, at the same size, so the animation moves no
 * other content. Three.js loads only after the page load, and only when the shopper allows motion; a button plays it
 * on request in each other case.
 */
export function HeroStage(props: { caption: string }) {
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
      const hasIdleMotion = !prefersLessMotion() && !posterCapture;
      const animation = await startHeroAnimation({
        canvas,
        qrSource: assetUrl('kiosk-code.png'),
        hasIdleMotion,
        onEnd: () => setPhase(hasIdleMotion ? 'holding' : 'ended'),
      });
      animationRef.current = animation;
      if (posterCapture) {
        // The QR texture loads after the GLB. One second is ample on a local server.
        setTimeout(() => {
          animation.seek(animation.duration);
          document.documentElement.dataset.posterReady = 'true';
        }, 1000);
        setPhase('paused');
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

  const control = () => {
    const animation = animationRef.current;
    if (!animation) {
      void start();
      return;
    }
    if (phase === 'playing') {
      animation.pause();
      setPhase('paused');
    } else if (phase === 'holding') {
      animation.pause();
      setPhase('ended');
    } else if (phase === 'ended') {
      animation.restart();
      setPhase('playing');
    } else {
      animation.play();
      setPhase('playing');
    }
  };

  // As the hero scrolls away, the object sinks back a little. With reduced motion it stays still.
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const depth = useTransform(scrollY, [0, 700], [1, 0.9]);
  const fade = useTransform(scrollY, [0, 700], [1, 0.4]);

  const isMoving = phase === 'playing' || phase === 'holding';
  const showsCanvas = isMoving || phase === 'paused' || phase === 'ended';
  const label = isMoving ? 'Pause the animation' : phase === 'ended' ? 'Play the animation again' : 'Play the animation';
  const glyph = isMoving ? Pause : phase === 'ended' ? RotateCcw : Play;

  return (
    <figure className="hero-media" data-phase={phase} data-capture={posterCapture ? 'poster' : undefined}>
      <m.div className="hero-media__frame" style={reduceMotion || posterCapture ? undefined : { scale: depth, opacity: fade }}>
        <Picture
          className="hero-media__poster"
          name="hero-poster"
          widths={[480, 960, 1440]}
          sizes="(min-width: 64rem) 40rem, 80vw"
          alt=""
          width={1440}
          height={1440}
          isPriority
        />
        <canvas ref={canvasRef} className="hero-media__canvas" data-visible={showsCanvas} aria-hidden="true" />
      </m.div>
      <div className="hero-media__bar">
        <figcaption className="hero-media__caption">
          <span className="visually-hidden">Animation of the Meta Glance mark. </span>
          {props.caption}
        </figcaption>
        {phase === 'failed' || posterCapture ? null : (
          <Button label={label} isIconOnly icon={<Icon icon={glyph} />} size="lg" isLoading={phase === 'loading'} onClick={control} tooltip={label} />
        )}
      </div>
    </figure>
  );
}
