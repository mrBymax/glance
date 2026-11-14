import './styles/globals.css';
import { Theme } from '@astryxdesign/core/theme';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

const page = (
  <StrictMode>
    <Theme theme={themes[defaultThemeSlug]}>
      <App />
    </Theme>
  </StrictMode>
);

// The build writes the HTML of the page into #root (scripts/prerender.mjs). The dev server serves an empty #root.
if (root.hasChildNodes()) hydrateRoot(root, page);
else createRoot(root).render(page);
