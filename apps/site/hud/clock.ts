/*
 * A clock for the timers of the HUD that the site page can pause. It replaces window.setTimeout and clearTimeout
 * before HudPage loads, so the recorded mode of the HUD (playRecording in feed.ts) runs on it unchanged.
 * Time moves only while the page has sent "play": the HUD then plays while it is in view and stops when it is not.
 */
type Timer = { id: number; at: number; run: () => void };

const nativeRequestFrame = window.requestAnimationFrame.bind(window);
const timers = new Map<number, Timer>();
let now = 0;
let nextId = 1;
let playing = false;
let last: number | null = null;

function fireDue(until: number) {
  for (;;) {
    let due: Timer | undefined;
    for (const timer of timers.values()) if (timer.at <= until && (!due || timer.at < due.at)) due = timer;
    if (!due) break;
    timers.delete(due.id);
    now = due.at;
    due.run();
  }
  now = until;
}

function frame(real: number) {
  if (playing) {
    const step = last === null ? 0 : Math.min(real - last, 100);
    last = real;
    fireDue(now + step);
  } else {
    last = null;
  }
  nativeRequestFrame(frame);
}
nativeRequestFrame(frame);

window.setTimeout = ((handler: TimerHandler, delay = 0, ...args: unknown[]) => {
  const id = nextId++;
  const run = typeof handler === 'function' ? () => (handler as (...a: unknown[]) => void)(...args) : () => undefined;
  timers.set(id, { id, at: now + Math.max(0, Number(delay) || 0), run });
  return id;
}) as typeof window.setTimeout;

window.clearTimeout = ((id?: number) => {
  if (id !== undefined) timers.delete(id);
}) as typeof window.clearTimeout;

export const clock = {
  play() {
    playing = true;
  },
  pause() {
    playing = false;
  },
  /** Runs each timer up to the given time of the clock at once, and stops there. */
  jumpTo(time: number) {
    playing = false;
    if (time > now) fireDue(time);
  },
};
