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
  return (
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
  );
}
