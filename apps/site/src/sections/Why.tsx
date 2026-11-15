import { Icon } from '@astryxdesign/core/Icon';
import { Ear, Hand, type LucideIcon, ShieldCheck, Smartphone } from 'lucide-react';
import { WHY } from '../content/site';
import { Reveal } from '../motion/Reveal';

const GLYPHS: readonly LucideIcon[] = [Hand, Ear, Smartphone, ShieldCheck];

/** Why the loop matters: for full hands, for eyes that cannot read the code, and for a phone that stays put. */
export function Why() {
  return (
    <section id="why" className="section" aria-labelledby="why-title">
      <div className="container">
        <Reveal className="section-head section-head--center">
          <h2 id="why-title" className="section-title">
            {WHY.heading}
          </h2>
          <p className="lead">{WHY.lead}</p>
        </Reveal>
        <ul className="control__list">
          {WHY.items.map((item, index) => (
            <Reveal as="li" key={item.title} className="control__item" index={index}>
              <span className="control__glyph" aria-hidden="true">
                <Icon icon={GLYPHS[index] ?? Hand} size="lg" />
              </span>
              <h3 className="control__item-title">{item.title}</h3>
              <p className="control__item-body">{item.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
