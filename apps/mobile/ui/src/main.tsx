import './styles/globals.css';
import { Theme } from '@astryxdesign/core/theme';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

// No StrictMode: it runs each effect two times in development, and the bridge effects send messages to the app.
createRoot(root).render(
  <Theme theme={themes[defaultThemeSlug]}>
    <App />
  </Theme>,
);
