import { Button } from '@astryxdesign/core/Button';
import { useEffect, useState } from 'react';
import { HERO, SECTIONS, type SectionId } from '../content/site';
import { Wordmark } from './Wordmark';

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

/** The sticky bar: the product name, the section links, and the primary action. */
export function SiteHeader() {
  const current = useCurrentSection();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__home" href="#top" aria-label="Meta Glance, back to the top">
          <Wordmark />
        </a>
        <nav className="site-header__nav" aria-label="Sections">
          <ul>
            {SECTIONS.map(({ id, nav }) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={current === id ? 'true' : undefined}>
                  {nav}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__action">
          <Button label={HERO.primaryAction.label} variant="primary" href={HERO.primaryAction.href} />
        </div>
      </div>
    </header>
  );
}
