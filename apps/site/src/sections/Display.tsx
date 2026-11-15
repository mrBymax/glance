import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Theme } from '@astryxdesign/core/theme';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { Picture } from '../components/Picture';
import { DISPLAY } from '../content/site';
import { Reveal } from '../motion/Reveal';

/** The HUD is drawn for a display of 600 x 600 pixels. The frame scales it to the width of its box. */
const HUD_SIZE = 600;
const HUD_URL = `${import.meta.env.BASE_URL}hud/index.html`;

/**
 * The Display HUD of the app, built with its own toolkit, in a sandboxed frame (public/hud, see hud/README.md).
 * A still of the key state shows first, at the same size. The frame loads when the section nears the view. It plays
 * while it is in view and pauses when it is not. With reduced motion it waits for the Play button. The frame takes no
 * focus and no input: the text alternative below says what the display shows.
 */
function HudFrame() {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isNear, setIsNear] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isReady, setIsReady] = useState(false);
  // null until the first render on the client: then false with reduced motion, true otherwise.
  const [isPlaying, setIsPlaying] = useState<boolean | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setIsPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const box = boxRef.current;
    if (!box) return undefined;
    const resize = new ResizeObserver(() => setScale(box.clientWidth / HUD_SIZE));
    resize.observe(box);
    const near = new IntersectionObserver(([entry]) => entry?.isIntersecting && setIsNear(true), { rootMargin: '600px 0px' });
    near.observe(box);
    const view = new IntersectionObserver(([entry]) => setIsInView(entry?.isIntersecting ?? false), { threshold: 0.25 });
    view.observe(box);
    return () => {
      resize.disconnect();
      near.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const onMessage = (message: MessageEvent) => {
      if (message.source !== frameRef.current?.contentWindow) return;
      if ((message.data as { glanceHud?: string } | null)?.glanceHud === 'ready') setIsReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    frameRef.current?.contentWindow?.postMessage({ glanceHud: isPlaying && isInView ? 'play' : 'pause' }, '*');
  }, [isReady, isInView, isPlaying]);

  // With reduced motion the still stays, and the frame loads only after the first press of Play.
  const loadsFrame = isNear && (isPlaying === true || isReady);
  const label = isPlaying ? DISPLAY.pause : DISPLAY.play;

  return (
    <>
      <div className="lens">
        <svg className="lens__outline" viewBox="0 0 640 480" aria-hidden="true" focusable="false">
          <path d="M60 70 C 60 40, 90 28, 140 28 H 520 C 580 28, 612 52, 604 120 L 582 330 C 572 410, 520 452, 440 452 H 210 C 130 452, 82 410, 72 330 L 56 120 C 52 96, 54 80, 60 70 Z" />
        </svg>
        <div ref={boxRef} className="hud__screen" data-ready={isReady}>
          <Picture
            className="hud__still"
            name="hud-still"
            widths={[600, 1200]}
            sizes="(min-width: 64rem) 24rem, 80vw"
            width={1200}
            height={1200}
            alt=""
          />
          {loadsFrame ? (
            <iframe
              ref={frameRef}
              className="hud__frame"
              src={HUD_URL}
              title={DISPLAY.frameTitle}
              width={HUD_SIZE}
              height={HUD_SIZE}
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
              tabIndex={-1}
              aria-hidden="true"
              inert
              style={{ transform: `scale(${scale})` }}
            />
          ) : null}
        </div>
      </div>
      <div className="hud__control">
        <Button
          label={label}
          size="md"
          icon={<Icon icon={isPlaying ? Pause : Play} />}
          onClick={() => {
            setIsPlaying(!isPlaying);
            setIsNear(true);
          }}
        />
      </div>
    </>
  );
}

/** The same loop on glasses with a display: the HUD of the store demo, in the lens. */
export function Display() {
  return (
    <section id="display" className="section" aria-labelledby="display-title">
      <div className="container">
        <Reveal className="section-head section-head--center">
          <h2 id="display-title" className="section-title">
            {DISPLAY.heading}
          </h2>
          <p className="lead">{DISPLAY.lead}</p>
        </Reveal>
        <Theme theme={themes[defaultThemeSlug]} mode="dark">
          <figure className="lens-stage">
            <HudFrame />
            <figcaption className="visually-hidden">
              <p>{DISPLAY.textAlternativeIntro}</p>
              <ol>
                {DISPLAY.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </figcaption>
          </figure>
        </Theme>
      </div>
    </section>
  );
}
