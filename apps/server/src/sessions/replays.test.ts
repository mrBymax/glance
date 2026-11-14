// Live results flicker. These tests replay result sequences with gaps and changes.
import { expect, it } from 'vitest';
import { EMPTY_CART, TIMING as T } from '@glance/shared';
import { BARISTA, type Harness, OAT, RYE, harness } from './harness';
import type { SpeakEffect } from './types';

const pendings = (h: Harness) => h.all.filter((e) => e.type === 'event' && e.event.type === 'glance.pending');
const spoken = (h: Harness) => h.all.filter((e): e is SpeakEffect => e.type === 'speak').map((e) => e.line.key);

it('gaps shorter than the view time keep one prompt', () => {
  const h = harness();
  h.see(OAT);
  h.at(500); h.result({ status: 'none' });
  h.at(1000); h.see(OAT);
  h.at(2000); h.result({ status: 'none' });
  h.at(3900); h.see(OAT);
  expect(pendings(h)).toHaveLength(1);
});
it('a gap of the view time gives a new prompt, and the old prompt ID adds nothing', () => {
  const h = harness();
  h.see(OAT); h.done(); const first = h.state.prompt!.id;
  h.at(T.viewMs); h.see(OAT);
  expect(pendings(h)).toHaveLength(2);
  h.yes('head', first);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('a one-frame change replaces the prompt, and each yes adds only the product of its own prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); const p1 = h.state.prompt!.id;
  h.at(500); h.see(BARISTA); const p2 = h.state.prompt!.id;
  h.at(1000); h.see(OAT); const p3 = h.state.prompt!.id;
  expect(new Set([p1, p2, p3]).size).toBe(3);
  h.yes('head', p1); h.yes('voice', p2);
  expect(h.state.cart).toEqual(EMPTY_CART);
  h.done(); h.yes('head');
  expect(h.state.cart.items.map((i) => i.productId)).toEqual([OAT]);
});
it('a late prompt.done for a replaced prompt finishes no prompt', () => {
  const h = harness();
  h.see(OAT); const p1 = h.state.prompt!.id;
  h.at(500); h.see(RYE);
  h.send({ type: 'prompt.done', promptId: p1 });
  expect(h.state.prompt!.doneAt).toBeNull();
  h.yes('head', p1); h.yes('voice', h.state.prompt!.id);
  expect(h.state.cart).toEqual(EMPTY_CART);
});
it('an added product that flickers for 10 seconds gets no second prompt and no second unit', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('head');
  for (let t = 500; t <= 10000; t += 500) {
    h.at(t);
    if (t % 1500 === 0) h.result({ status: 'none' }); else h.see(OAT);
  }
  expect(pendings(h)).toHaveLength(1);
  expect(h.state.cart.items[0]!.qty).toBe(1);
});
it('unsure and unknown results between results of the pending product say nothing', () => {
  const h = harness();
  h.see(OAT);
  h.at(500); h.result({ status: 'unsure', aimHint: 'left' });
  h.at(1000); h.result({ status: 'unknown' });
  h.at(1500); h.see(OAT);
  expect(spoken(h)).toEqual(['glance.new']);
});
it('a muted product in view does not suspend the checkout', () => {
  const h = harness({ cart: [RYE] });
  h.see(OAT); h.done(); h.yes('head');
  h.kiosk();
  h.at(500); h.see(OAT);
  expect(h.state.checkout!.step).toBe('offered');
});
