import { Button } from '@astryxdesign/core/Button';
import { Theme } from '@astryxdesign/core/theme';
import { defaultThemeSlug, themes } from '../astryx-themes';
import { HERO, PRODUCT } from '../content/site';
import { HeroStage } from '../hero/HeroStage';

/** The opening: a dark stage with the animation, then the name and the claim, one sentence, and two actions. */
export function Hero() {
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__inner">
          <HeroStage />
          <div className="hero__copy">
            <h1 id="hero-title" className="hero__title">
              <span className="hero__name">{PRODUCT.name}</span>
              <span className="hero__claim">{PRODUCT.claim}</span>
            </h1>
            <p className="hero__sentence">{PRODUCT.sentence}</p>
            <div className="action-row">
              <Button label={HERO.primaryAction.label} variant="primary" size="lg" href={HERO.primaryAction.href} />
              <Button label={HERO.secondaryAction.label} size="lg" href={HERO.secondaryAction.href} />
            </div>
          </div>
        </div>
      </section>
    </Theme>
  );
}
