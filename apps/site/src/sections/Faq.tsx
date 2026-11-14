import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible';
import { FAQ } from '../content/site';

export function Faq() {
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className="container faq">
        <h2 id="faq-title" className="section-title faq__title">
          {FAQ.heading}
        </h2>
        <CollapsibleGroup type="multiple" defaultValue={['faq-0']} hasDividers density="spacious" className="faq__list">
          {FAQ.items.map((item, index) => (
            <Collapsible key={item.question} value={`faq-${index}`} trigger={<span className="faq__question">{item.question}</span>}>
              <p className="faq__answer">{item.answer}</p>
            </Collapsible>
          ))}
        </CollapsibleGroup>
      </div>
    </section>
  );
}
