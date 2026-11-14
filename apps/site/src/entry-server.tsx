import { Theme } from '@astryxdesign/core/theme';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';

/** The HTML of the page at build time. scripts/prerender.mjs writes it into dist/index.html, and main.tsx hydrates it. */
export function render(): string {
  return renderToString(
    <Theme theme={themes[defaultThemeSlug]}>
      <App />
    </Theme>,
  );
}
