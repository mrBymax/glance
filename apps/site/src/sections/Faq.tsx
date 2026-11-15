import { ChevronDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useId, useState } from 'react';
import { FAQ } from '../content/site';
import { EASE_OUT } from '../motion/Reveal';

/**
 * One question: a heading that holds the button, as the disclosure pattern of the WAI-ARIA practices asks.
 * The answer opens and closes with its height animated, and the chevron turns.
 */
function Question(props: { question: string; answer: string; isInitiallyOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(props.isInitiallyOpen);
  const answerId = useId();
  return (
    <div className="faq__item">
      <h3 className="faq__heading">
        <button type="button" className="faq__button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setIsOpen(!isOpen)}>
          <span className="faq__question">{props.question}</span>
          <m.span className="faq__chevron" aria-hidden="true" initial={false} animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <ChevronDown />
          </m.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <m.div
            id={answerId}
            className="faq__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <p className="faq__answer">{props.answer}</p>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className="container faq">
        <h2 id="faq-title" className="section-title faq__title">
          {FAQ.heading}
        </h2>
        <div className="faq__list">
          {FAQ.items.map((item, index) => (
            <Question key={item.question} question={item.question} answer={item.answer} isInitiallyOpen={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
