import type { CSSProperties } from 'react';

// Each optimized image of scripts/build-assets.mjs, by its file name.
const FILES = import.meta.glob<string>('../assets/generated/*.{avif,webp,png,svg}', { eager: true, query: '?url', import: 'default' });
const urls = new Map(Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]));

export function assetUrl(file: string): string {
  const url = urls.get(file);
  if (!url) throw new Error(`${file} is not in src/assets/generated. Run "npm run assets".`);
  return url;
}

function srcSet(name: string, widths: readonly number[], format: 'avif' | 'webp'): string {
  return widths.map((width) => `${assetUrl(`${name}-${width}.${format}`)} ${width}w`).join(', ');
}

type PictureProps = {
  /** The file name before "-<width>.<format>", for example "team-mc". */
  name: string;
  /** The image for the dark color scheme, with the same widths. */
  darkName?: string;
  widths: readonly number[];
  sizes: string;
  alt: string;
  /** The intrinsic size of the image. It reserves the space before the image loads. */
  width: number;
  height: number;
  /** The image is the largest paint of the first screen: it loads at once, with a high priority. */
  isPriority?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** An image in AVIF with a WebP fallback, at several widths, with a reserved size. */
export function Picture({ name, darkName, widths, sizes, alt, width, height, isPriority = false, className, style }: PictureProps) {
  const largest = widths[widths.length - 1];
  return (
    <picture>
      {darkName ? <source media="(prefers-color-scheme: dark)" type="image/avif" srcSet={srcSet(darkName, widths, 'avif')} sizes={sizes} /> : null}
      {darkName ? <source media="(prefers-color-scheme: dark)" type="image/webp" srcSet={srcSet(darkName, widths, 'webp')} sizes={sizes} /> : null}
      <source type="image/avif" srcSet={srcSet(name, widths, 'avif')} sizes={sizes} />
      <img
        className={className}
        style={style}
        src={assetUrl(`${name}-${largest}.webp`)}
        srcSet={srcSet(name, widths, 'webp')}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={isPriority ? 'eager' : 'lazy'}
        fetchPriority={isPriority ? 'high' : undefined}
        decoding="async"
      />
    </picture>
  );
}
