import { assetUrl } from './Picture';

// The view box of the slim logo files of scripts/build-assets.mjs: 5866 x 1040 units.
const RATIO = 5866 / 1040;

/**
 * The logo of the project, from assets/Glance.svg and assets/Glance Dark.svg. The dark file has a white word mark,
 * for the dark color scheme. `height` is in CSS pixels; the width follows the drawing.
 */
export function Logo(props: { height: number; alt: string }) {
  const { height, alt } = props;
  return (
    <picture className="logo">
      <source media="(prefers-color-scheme: dark)" srcSet={assetUrl('logo-dark.svg')} />
      <img src={assetUrl('logo-light.svg')} width={Math.round(height * RATIO)} height={height} alt={alt} decoding="async" />
    </picture>
  );
}
