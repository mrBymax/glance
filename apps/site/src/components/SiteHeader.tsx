import { Button } from '@astryxdesign/core/Button';
import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import { EASE_OUT } from '../motion/Reveal';
import { HERO, SECTIONS, type SectionId } from '../content/site';
import { ActionLift } from '../motion/Lift';
import { Logo } from './Logo';

/**
 * The current section: the last one whose top is above a line a quarter down the viewport.
 * Above the first section, no link is current.
 */
function useCurrentSection(): SectionId | null {
  const [current, setCurrent] = useState<SectionId | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.25;
      let found: SectionId | null = null;
      for (const { id } of SECTIONS) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) found = id;
      }
      setCurrent(found);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return current;
}

/**
 * Publishes the height of the header as --site-header-measured on the root element. The hero, the scroll padding, and
 * the anchors use it. The CSS default is the same height for the default font size, so the first paint does not move.
 */
function useHeaderHeight() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return undefined;
    const publish = () => document.documentElement.style.setProperty('--site-header-measured', `${header.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    publish();
    return () => observer.disconnect();
  }, []);
  return ref;
}

/**
 * The section links. A pill slides under the link of the current section; on a phone, where the row scrolls, the row
 * also scrolls the current link into view.
 */
function SectionLinks(props: { current: SectionId | null }) {
  const { current } = props;
  const listRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [pill, setPill] = useState({ x: 0, width: 0, isVisible: false });

  useEffect(() => {
    const list = listRef.current;
    const link = current ? list?.querySelector<HTMLAnchorElement>(`a[href="#${current}"]`) : null;
    const scroller = list?.parentElement;
    const scrolls = scroller !== null && scroller !== undefined && scroller.scrollWidth > scroller.clientWidth;
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (!list || !link) {
      setPill((previous) => ({ ...previous, isVisible: false }));
      if (scrolls) scroller.scrollTo({ left: 0, behavior });
      return;
    }
    setPill({ x: link.offsetLeft, width: link.offsetWidth, isVisible: true });
    if (scrolls) scroller.scrollTo({ left: link.offsetLeft - scroller.clientWidth / 2 + link.offsetWidth / 2, behavior });
  }, [current, reduceMotion]);

  return (
    <nav className="site-header__nav" aria-label="Sections">
      <ul ref={listRef}>
        <m.li
          className="site-header__pill"
          role="none"
          aria-hidden="true"
          initial={false}
          animate={{ x: pill.x, width: pill.width, opacity: pill.isVisible ? 1 : 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        />
        {SECTIONS.map(({ id, nav }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? 'true' : undefined}>
              {nav}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The sticky bar: the logo, the section links, and the primary action. */
export function SiteHeader() {
  const current = useCurrentSection();
  const ref = useHeaderHeight();
  return (
    <header ref={ref} className="site-header">
      <div className="site-header__inner">
        <a className="site-header__home" href="#top" aria-label="Meta Glance, back to the top">
          <Logo height={28} alt="" />
        </a>
        <SectionLinks current={current} />
        <div className="site-header__action">
          <ActionLift>
            <Button label={HERO.primaryAction.label} variant="primary" href={HERO.primaryAction.href} />
          </ActionLift>
        </div>
      </div>
    </header>
  );
}
