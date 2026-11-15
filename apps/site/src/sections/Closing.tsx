import { Button } from '@astryxdesign/core/Button';
import { Link } from '@astryxdesign/core/Link';
import { Picture } from '../components/Picture';
import { Logo } from '../components/Logo';
import { CLOSING, FOOTER, REPOSITORY, SECTIONS } from '../content/site';
import { Reveal } from '../motion/Reveal';

export function Closing() {
  return (
    <section className="section closing" aria-labelledby="closing-title">
      <Reveal className="container container--narrow center">
        <a className="closing__mark" href={REPOSITORY.url} aria-label={REPOSITORY.cardLabel}>
          <Picture name="hero-poster" widths={[480, 960]} sizes="12rem" width={960} height={960} alt="" />
        </a>
        <h2 id="closing-title" className="statement">
          {CLOSING.heading}
        </h2>
        <p className="lead">{CLOSING.body}</p>
        <div className="action-row action-row--center">
          <Button label={CLOSING.primaryAction.label} variant="primary" size="lg" href={CLOSING.primaryAction.href} />
          <Button label={CLOSING.secondaryAction.label} size="lg" href={CLOSING.secondaryAction.href} />
        </div>
      </Reveal>
    </section>
  );
}

export function SiteFooter() {
  const { openFoodFacts } = FOOTER;
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <Logo height={32} alt="Meta Glance" />
          <p className="site-footer__note">{FOOTER.independence}</p>
          <p className="site-footer__note">
            {openFoodFacts.before}
            <Link href={openFoodFacts.href} type="inherit" color="inherit" hasUnderline>
              {openFoodFacts.name}
            </Link>
            {openFoodFacts.middle}
            <Link href={openFoodFacts.licenceHref} type="inherit" color="inherit" hasUnderline>
              {openFoodFacts.licence}
            </Link>
            {openFoodFacts.after}
          </p>
        </div>
        <nav className="site-footer__nav" aria-label="Footer">
          <ul>
            {SECTIONS.map(({ id, nav }) => (
              <li key={id}>
                <a href={`#${id}`}>{nav}</a>
              </li>
            ))}
            <li>
              <a href="#top">Back to the top</a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
