import './styles/globals.css';
import { Theme } from '@astryxdesign/core/theme';
import type { GlanceBridge } from '@glance/shared';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';
import { createBridge } from './bridge/createBridge';

declare global {
  interface Window {
    /** The bridge of the page, in development only, for the browser console. */
    glanceBridge?: GlanceBridge;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

const bridge = createBridge(window, location.search);
if (import.meta.env.DEV) window.glanceBridge = bridge;

// No StrictMode: it runs each effect two times in development, and the bridge effects send messages to the app.
createRoot(root).render(
  <Theme theme={themes[defaultThemeSlug]}>
    <App />
  </Theme>,
);
