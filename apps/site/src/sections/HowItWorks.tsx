import * as m from 'motion/react-m';
import { INTRO, LOOP } from '../content/site';
import { EASE_OUT, Reveal } from '../motion/Reveal';

// The numeral rises out of its own line box after its step appears.
const numeral = {
  hidden: { y: '0.5em', opacity: 0, transition: { duration: 0 } },
  shown: (index: number) => ({ y: 0, opacity: 1, transition: { duration: 0.7, ease: EASE_OUT, delay: 0.12 + index * 0.08 } }),
};

/** The statement after the hero, then the loop of the protocol, each step under one large numeral as in the phone app. */
export function HowItWorks() {
  return (
    <>
      <section className="section section--intro" aria-labelledby="intro-title">
        <Reveal className="container container--narrow center">
          <h2 id="intro-title" className="statement">
            {INTRO.heading}
          </h2>
          <p className="lead">{INTRO.body}</p>
        </Reveal>
      </section>
      <section id="how-it-works" className="section" aria-labelledby="how-title">
        <div className="container">
          <Reveal className="section-head">
            <h2 id="how-title" className="section-title">
              {LOOP.heading}
            </h2>
            <p className="lead">{LOOP.lead}</p>
          </Reveal>
          <ol className="steps">
            {LOOP.steps.map((step, index) => (
              <Reveal as="li" key={step.title} className="step" index={index}>
                <span className="step__numeral-box" aria-hidden="true">
                  <m.span className="step__numeral" variants={numeral} custom={index}>
                    {index + 1}
                  </m.span>
                </span>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__body">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
