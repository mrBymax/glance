import { Glasses } from 'lucide-react';
import { PRODUCT } from '../content/site';

/**
 * The mark of the site: the glasses glyph in an ink disc, as in the phone app, and the product name.
 * The mark carries no logo of Meta.
 */
export function Wordmark(props: { isLarge?: boolean }) {
  return (
    <span className={props.isLarge ? 'wordmark wordmark--large' : 'wordmark'}>
      <span className="wordmark__disc" aria-hidden="true">
        <Glasses strokeWidth={2} />
      </span>
      <span className="wordmark__name">{PRODUCT.name}</span>
    </span>
  );
}
