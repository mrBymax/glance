import { expect, it } from 'vitest';
import { KIOSK_RUN, KIOSK_SPOT_RUN, SPOT_MS } from './kioskRun';

const states = (run: typeof KIOSK_RUN) => run.map((entry) => entry.event.state);

it('adds one spot check of 4 seconds after each connected event', () => {
  expect(SPOT_MS).toBe(4000);
  expect(states(KIOSK_SPOT_RUN)).toEqual([
    'idle', 'connected', 'spotcheck', 'connected', 'paid', 'idle', 'connected', 'spotcheck', 'connected', 'failed', 'idle',
  ]);
  KIOSK_SPOT_RUN.forEach((entry, index) => {
    const next = KIOSK_SPOT_RUN[index + 1];
    if (entry.event.state === 'spotcheck') expect(next!.afterMs - entry.afterMs).toBe(SPOT_MS);
    if (next) expect(next.afterMs).toBeGreaterThan(entry.afterMs);
  });
});
it('keeps the cart and the total during the spot check, and the time of each other state', () => {
  const spot = KIOSK_SPOT_RUN.find((entry) => entry.event.state === 'spotcheck')!.event;
  const connected = KIOSK_RUN.find((entry) => entry.event.state === 'connected')!.event;
  expect(spot).toEqual({ ...connected, state: 'spotcheck' });
  const gaps = (run: typeof KIOSK_RUN, state: string) => run.flatMap((entry, index) =>
    (entry.event.state === state && run[index + 1] ? [run[index + 1]!.afterMs - entry.afterMs] : []));
  for (const state of ['idle', 'paid', 'failed']) expect(gaps(KIOSK_SPOT_RUN, state)).toEqual(gaps(KIOSK_RUN, state));
});
