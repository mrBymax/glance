import { useEffect, useState } from 'react';
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';

// The view box of both logo files: 5866 x 1040 units.
const RATIO = 5866 / 1040;

/**
 * The height of the logo in CSS pixels: on the first screen, and in the header of the session.
 * A logotype keeps its size at each font scale, and the text alternative carries the name.
 */
const HEIGHTS = { hero: 40, header: 30 } as const;

// The entrance plays once for each load of the page. The loading screen and the setup screen show the logo at the same
// place, so a second fade on the setup screen would blink.
let hasEntered = false;

/**
 * The logo of the project, from assets/Glance.svg and assets/Glance Dark.svg. The dark file has a white word mark, for
 * the dark color scheme, which the page follows (the Astryx theme has the mode `system`).
 * An empty `alt` makes the logo decorative.
 */
export function Logo(props: { size: keyof typeof HEIGHTS; alt: string; hasEntrance?: boolean }) {
  const { size, alt, hasEntrance = false } = props;
  const height = HEIGHTS[size];
  const [enters] = useState(() => hasEntrance && !hasEntered);
  useEffect(() => {
    if (enters) hasEntered = true;
  }, [enters]);
  return (
    <picture className={enters ? 'glance-logo glance-logo--enter' : 'glance-logo'}>
      <source media="(prefers-color-scheme: dark)" srcSet={logoDark} />
      <img src={logoLight} width={Math.round(height * RATIO)} height={height} alt={alt} />
    </picture>
  );
}
