import { Icon } from '@astryxdesign/core/Icon';
import { Theme } from '@astryxdesign/core/theme';
import { CircleCheck, FlaskConical } from 'lucide-react';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { STATUS } from '../content/site';
import { Reveal } from '../motion/Reveal';

/** The honest part of the page, on a dark band: what runs today and what is a demo. */
export function Status() {
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <section id="status" className="section band" aria-labelledby="status-title">
        <div className="container">
          <Reveal className="section-head">
            <p className="eyebrow">{STATUS.eyebrow}</p>
            <h2 id="status-title" className="section-title">
              {STATUS.heading}
            </h2>
            <p className="lead">{STATUS.lead}</p>
          </Reveal>
          <div className="status-columns">
            <Reveal as="section" className="status-list" labelledBy="status-real">
              <h3 id="status-real" className="status-list__title">
                {STATUS.real.title}
              </h3>
              <ul>
                {STATUS.real.items.map((item) => (
                  <li key={item}>
                    <span className="status-list__glyph status-list__glyph--real" aria-hidden="true">
                      <Icon icon={CircleCheck} size="md" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal as="section" className="status-list" labelledBy="status-demo" index={1}>
              <h3 id="status-demo" className="status-list__title">
                {STATUS.demo.title}
              </h3>
              <ul>
                {STATUS.demo.items.map((item) => (
                  <li key={item}>
                    <span className="status-list__glyph" aria-hidden="true">
                      <Icon icon={FlaskConical} size="md" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>
    </Theme>
  );
}
