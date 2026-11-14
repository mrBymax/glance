import { parseNativeToPage, type NativeToPage } from '@glance/shared';
import { expect, it, vi } from 'vitest';
import { initialUiState, reduce } from '../state/uiState';
import { DEMO_RUN, playRecording } from './demoRun';
import { eventMessage } from './fixtures';

it('delivers each message at its time, and stops on request', () => {
  vi.useFakeTimers();
  const seen: NativeToPage[] = [];
  const message = eventMessage('glance.unknown');
  const stop = playRecording([{ afterMs: 0, message }, { afterMs: 1000, message }, { afterMs: 2000, message }], (m) => seen.push(m));
  vi.advanceTimersByTime(1000);
  expect(seen).toHaveLength(2);
  stop();
  vi.advanceTimersByTime(5000);
  expect(seen).toHaveLength(2);
  vi.useRealTimers();
});
it('holds a demo run that the bridge schema accepts, in time order, to the payment', () => {
  for (const entry of DEMO_RUN) expect(parseNativeToPage(entry.message)).not.toBeNull();
  const times = DEMO_RUN.map((entry) => entry.afterMs);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(DEMO_RUN.map((entry) => entry.message).reduce(reduce, initialUiState).checkout).toBe('paid');
});
it('starts the demo run with one cart line, and adds the oat drink for a total of 4.49 EUR', () => {
  const states = DEMO_RUN.map((_, index) => DEMO_RUN.slice(0, index + 1).map((entry) => entry.message).reduce(reduce, initialUiState));
  expect(states[0]?.cart).toMatchObject({ totalCents: 260, items: [{ productId: 'rye-bread' }] });
  expect(states.some((state) => state.prompt?.kind === 'product' && state.prompt.mode === 'new')).toBe(true);
  expect(states.some((state) => state.cart.totalCents === 449 && state.cart.items.length === 2)).toBe(true);
});
