import { BUILDERS } from '../content/site';
import { Reveal } from '../motion/Reveal';
import { PartsDiagram } from './PartsDiagram';

/** How a place, the glasses, and the Glance server fit together, for Meta and for anyone who builds a place. */
export function Builders() {
  return (
    <section id="builders" className="section" aria-labelledby="builders-title">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="builders-title" className="section-title">
            {BUILDERS.heading}
          </h2>
          <p className="lead">{BUILDERS.lead}</p>
        </Reveal>
        <PartsDiagram />
        <dl className="specs">
          {BUILDERS.integration.map((item, index) => (
            <Reveal key={item.term} className="specs__row" index={index}>
              <dt>{item.term}</dt>
              <dd>{item.detail}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
