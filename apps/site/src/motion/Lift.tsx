import * as m from 'motion/react-m';
import type { ReactNode } from 'react';

const SPRING = { type: 'spring', stiffness: 380, damping: 30, mass: 0.6 } as const;

/** A restrained response for a primary action: up 2 px on hover, a little smaller on press. */
export function ActionLift(props: { children: ReactNode }) {
  return (
    <m.span className="lift" whileHover={{ y: -2 }} whileTap={{ y: 0, scale: 0.97 }} transition={SPRING}>
      {props.children}
    </m.span>
  );
}

/** A restrained hover for a card or a picture: up 4 px. It is not a control, so it has no press state. */
export function CardLift(props: { children: ReactNode; className?: string }) {
  return (
    <m.div className={props.className} whileHover={{ y: -4 }} transition={SPRING}>
      {props.children}
    </m.div>
  );
}
