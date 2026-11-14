import { TECHNOLOGY } from '../content/site';
import { Reveal } from '../motion/Reveal';
import { PartsDiagram } from './PartsDiagram';

export function Technology() {
  return (
    <section id="technology" className="section" aria-labelledby="technology-title">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="technology-title" className="section-title">
            {TECHNOLOGY.heading}
          </h2>
          <p className="lead">{TECHNOLOGY.lead}</p>
        </Reveal>
        <PartsDiagram />
        <dl className="specs">
          {TECHNOLOGY.specs.map((spec, index) => (
            <Reveal key={spec.term} className="specs__row" index={index}>
              <dt>{spec.term}</dt>
              <dd>{spec.detail}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
