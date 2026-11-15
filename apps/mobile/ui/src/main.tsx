import './styles/globals.css';
import { Theme } from '@astryxdesign/core/theme';
import type { GlanceBridge } from '@glance/shared';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { defaultThemeSlug, themes } from './astryx-themes';
import { BridgeProvider } from './bridge/BridgeContext';
import { BrowserBridge } from './bridge/browserBridge';
import { createBridge } from './bridge/createBridge';
import { DEMO_RUN, playRecording } from './debug/demoRun';

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

if (bridge instanceof BrowserBridge && new URLSearchParams(location.search).get('replay') === '1') {
  // The page listens to the bridge from its first effect, and a message before that is lost.
  // The first message of the bridge is its answer to ui.ready, so the run starts there.
  const stopWaiting = bridge.subscribe(() => {
    stopWaiting();
    playRecording(DEMO_RUN, (message) => bridge.inject(message));
  });
}

// No StrictMode: it runs each effect two times in development, and the bridge effects send messages to the app.
createRoot(root).render(
  <Theme theme={themes[defaultThemeSlug]}>
    <BridgeProvider bridge={bridge}>
      <App />
    </BridgeProvider>
  </Theme>,
);
