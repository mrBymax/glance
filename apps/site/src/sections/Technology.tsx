import { Icon } from '@astryxdesign/core/Icon';
import { ArrowRight, BookOpen, Glasses, Leaf, type LucideIcon, Server, Smartphone, Sparkles } from 'lucide-react';
import { TECHNOLOGY } from '../content/site';

function Node(props: { icon: LucideIcon; title: string; body: string; isSmall?: boolean }) {
  return (
    <div className={props.isSmall ? 'node node--small' : 'node'}>
      <span className="node__glyph">
        <Icon icon={props.icon} size={props.isSmall ? 'md' : 'lg'} />
      </span>
      <span className="node__title">{props.title}</span>
      <span className="node__body">{props.body}</span>
    </div>
  );
}

/** Two labeled arrows between two parts: one each way. */
function Link(props: { forward: string; back: string }) {
  return (
    <div className="link">
      <span className="link__label">
        {props.forward}
        <span className="link__arrow" aria-hidden="true">
          <ArrowRight />
        </span>
      </span>
      <span className="link__label link__label--back">
        <span className="link__arrow link__arrow--back" aria-hidden="true">
          <ArrowRight />
        </span>
        {props.back}
      </span>
    </div>
  );
}

export function Technology() {
  const { nodes, links } = TECHNOLOGY;
  return (
    <section id="technology" className="section" aria-labelledby="technology-title">
      <div className="container">
        <div className="section-head">
          <h2 id="technology-title" className="section-title">
            {TECHNOLOGY.heading}
          </h2>
          <p className="lead">{TECHNOLOGY.lead}</p>
        </div>
        <figure className="diagram">
          <div className="diagram__main">
            <Node icon={Glasses} {...nodes.glasses} />
            <Link forward={links.glassesToPhone} back={links.phoneToGlasses} />
            <Node icon={Smartphone} {...nodes.phone} />
            <Link forward={links.phoneToServer} back={links.serverToPhone} />
            <Node icon={Server} {...nodes.server} />
          </div>
          <div className="diagram__sources">
            <p className="diagram__sources-label">The server asks</p>
            <div className="diagram__sources-row">
              <Node icon={Sparkles} isSmall {...nodes.model} />
              <Node icon={BookOpen} isSmall {...nodes.storeList} />
              <Node icon={Leaf} isSmall {...nodes.openFoodFacts} />
            </div>
          </div>
          <figcaption className="visually-hidden">{TECHNOLOGY.diagramLabel}</figcaption>
        </figure>
        <dl className="specs">
          {TECHNOLOGY.specs.map((spec) => (
            <div key={spec.term} className="specs__row">
              <dt>{spec.term}</dt>
              <dd>{spec.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
