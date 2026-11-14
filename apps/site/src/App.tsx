import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { SiteHeader } from './components/SiteHeader';
import { Closing, SiteFooter } from './sections/Closing';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { Status } from './sections/Status';
import { Team } from './sections/Team';
import { Technology } from './sections/Technology';

export function App() {
  // domAnimation holds the animations, the gestures, and the in-view checks, without layout animation.
  // reducedMotion "user": with prefers-reduced-motion, each transform animation jumps to its end, and fades stay.
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div id="top" className="site">
          <a className="skip-link" href="#main">
            Skip to the content
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            <Hero />
            <HowItWorks />
            <Features />
            <Technology />
            <Status />
            <Team />
            <Faq />
            <Closing />
          </main>
          <SiteFooter />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
