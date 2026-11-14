import './styles/globals.css';
import { Theme } from '@astryxdesign/core/theme';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

// No StrictMode: the kiosk page registers in an effect, and StrictMode would register two kiosks in development.
createRoot(root).render(
  <Theme theme={themes[defaultThemeSlug]}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Theme>,
);
