import { INTRO, STEPS } from '../content/site';

/** The statement after the hero, then the four steps, each under one large numeral as in the phone app. */
export function HowItWorks() {
  return (
    <>
      <section className="section section--intro" aria-labelledby="intro-title">
        <div className="container container--narrow center">
          <h2 id="intro-title" className="statement">
            {INTRO.heading}
          </h2>
          <p className="lead">{INTRO.body}</p>
        </div>
      </section>
      <section id="how-it-works" className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <h2 id="how-title" className="section-title">
              {STEPS.heading}
            </h2>
            <p className="lead">{STEPS.lead}</p>
          </div>
          <ol className="steps">
            {STEPS.items.map((step, index) => (
              <li key={step.title} className="step">
                <span className="step__numeral" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
