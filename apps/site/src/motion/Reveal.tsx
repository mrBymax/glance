import { useInView } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const variants = {
  hidden: { opacity: 0, y: 16, transition: { duration: 0 } },
  shown: (index: number) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT, delay: Math.min(index, 6) * 0.07 } }),
};

/**
 * Fades an element in and moves it up 16 px, once, when it scrolls into view. `index` staggers the items of a grid.
 *
 * The server HTML and the first render show the element as it is, so the text never waits for the script. After the
 * first render, an element below the viewport turns invisible (the reader cannot see that change) and reveals itself
 * when it enters the view. Opacity and transform move no layout. With reduced motion, MotionConfig of App keeps the
 * fade and drops the move.
 */
export function Reveal(props: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section' | 'figure';
  id?: string;
  labelledBy?: string;
}) {
  const { children, index = 0, className, as = 'div', id, labelledBy } = props;
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const [state, setState] = useState<'shown' | 'hidden'>('shown');

  useEffect(() => {
    const element = ref.current;
    if (element && element.getBoundingClientRect().top > window.innerHeight) setState('hidden');
  }, []);

  useEffect(() => {
    if (isInView) setState('shown');
  }, [isInView]);

  const Tag = m[as];
  return (
    <Tag ref={ref as never} id={id} aria-labelledby={labelledBy} className={className} initial={false} animate={state} variants={variants} custom={index}>
      {children}
    </Tag>
  );
}
