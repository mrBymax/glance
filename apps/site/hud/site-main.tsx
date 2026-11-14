// The clock must replace the timers before HudPage loads: playRecording starts its timers when the page mounts.
import { clock } from './clock';
import './no-focus';
import { createRoot } from 'react-dom/client';
import { App as UITApp } from '@wearables-ui-toolkit/mrbd';
import { RESTART_PAUSE_MS } from './feed';
import { HudPage } from './HudPage';
import mainTake from './recordings/mainTake.json';
import './app.css';
import './noto-sans.css';

/*
 * The Display HUD of apps/display-pow in its recorded mode, for the product site: HudPage, feed.ts, hudState.ts, and
 * the recording are the files of that app, unchanged. This entry adds two things:
 *   - The site page drives the clock: "play" while the HUD is in view, "pause" when it is not, and "still" for the key
 *     state when the visitor prefers reduced motion.
 *   - The recording holds no answer. In each round, a press of Add stands in for a nod to the rye bread, and a press of
 *     Skip for a shake at the oat drink. HudPage answers them as in its recorded mode.
 */

const ROUND_MS = (mainTake.at(-1)?.afterMs ?? 0) + RESTART_PAUSE_MS;
const NOD_MS = 10500;
const SHAKE_MS = 21000;
// The key state: the rye bread waits for the nod, with its spoken line.
const STILL_MS = 6000;

/** A toolkit Button is an element with the attribute data-uit-interactable, not a button element. */
function press(title: string) {
  const button = [...document.querySelectorAll<HTMLElement>('[data-uit-interactable]')].find((element) => element.textContent?.trim() === title);
  button?.click();
}

function scheduleRound() {
  setTimeout(() => press('Add'), NOD_MS);
  setTimeout(() => press('Skip'), SHAKE_MS);
  setTimeout(scheduleRound, ROUND_MS);
}

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no element with the ID root.');

createRoot(root).render(
  <UITApp>
    <HudPage />
  </UITApp>,
);
scheduleRound();

window.addEventListener('message', (message) => {
  if (message.source !== window.parent || typeof message.data !== 'object' || message.data === null) return;
  const command = (message.data as { glanceHud?: string }).glanceHud;
  if (command === 'play') clock.play();
  if (command === 'pause') clock.pause();
  if (command === 'still') clock.jumpTo(STILL_MS);
});
window.parent.postMessage({ glanceHud: 'ready' }, '*');
