import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { SiteHeader } from './components/SiteHeader';
import { Closing, SiteFooter } from './sections/Closing';
import { Builders } from './sections/Builders';
import { Demo } from './sections/Demo';
import { Display } from './sections/Display';
import { Faq } from './sections/Faq';
import { Hero } from './sections/Hero';
import { HowItWorks } from './sections/HowItWorks';
import { Team } from './sections/Team';
import { UseCases } from './sections/UseCases';
import { Why } from './sections/Why';

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
            <UseCases />
            <Demo />
            <Display />
            <Builders />
            <Why />
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
