import type { ServerEvent } from '@glance/shared';
import { expect, it } from 'vitest';
import { event, SNAPSHOT } from '../test/events';
import { fromSnapshot, initialMirrorState, MIRROR_CAPTIONS, mirrorFlags, mirrorReduce } from './mirrorModel';

const caption = (n: number): ServerEvent => ({ ...event('caption'), id: `c-${n}`, text: `Line ${n}` });

it('keeps the last 5 captions, the cart, and the phase', () => {
  let state = initialMirrorState;
  for (let n = 0; n < 7; n += 1) state = mirrorReduce(state, caption(n));
  state = mirrorReduce(state, event('cart.updated'));
  state = mirrorReduce(state, { type: 'session.state', phase: 'checkout', cameraOn: true });
  expect(state.captions.map((c) => c.id)).toEqual(['c-2', 'c-3', 'c-4', 'c-5', 'c-6']);
  expect(state.cart.totalCents).toBe(449);
  expect(state.phase).toBe('checkout');
});
it('keeps one caption for each ID, with the newest text', () => {
  let state = mirrorReduce(initialMirrorState, caption(1));
  state = mirrorReduce(state, caption(2));
  state = mirrorReduce(state, { ...caption(1), text: 'Line 1, changed' } as ServerEvent);
  expect(state.captions.map((c) => c.text)).toEqual(['Line 1, changed', 'Line 2']);
});
it('ignores each other event', () => {
  expect(mirrorReduce(initialMirrorState, event('glance.pending'))).toBe(initialMirrorState);
});
it('takes the last 5 captions, the cart, and the phase of a snapshot', () => {
  const captions = Array.from({ length: 7 }, (_, n) => ({ ...SNAPSHOT.captions[0]!, id: `c-${n}` }));
  const state = fromSnapshot({ ...SNAPSHOT, phase: 'checkout', captions });
  expect(state.captions).toHaveLength(MIRROR_CAPTIONS);
  expect(state.captions.at(-1)?.id).toBe('c-6');
  expect(state.cart).toEqual(SNAPSHOT.cart);
  expect(state.phase).toBe('checkout');
});
it('reads the session and the token from the address', () => {
  expect(mirrorFlags('?s=s-1&t=t-1')).toEqual({ sessionId: 's-1', token: 't-1' });
  expect(mirrorFlags('?s=s-1')).toBeNull();
  expect(mirrorFlags('')).toBeNull();
});
it('reads the demo key from the address, and prefers a named session', () => {
  expect(mirrorFlags('?latest=k-demo')).toEqual({ latestKey: 'k-demo' });
  expect(mirrorFlags('?latest=k-demo&s=s-1&t=t-1')).toEqual({ sessionId: 's-1', token: 't-1' });
  expect(mirrorFlags('?latest=')).toBeNull();
});
