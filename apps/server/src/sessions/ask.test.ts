import { expect, it } from 'vitest';
import { ASK_WINDOW_MS } from '../ask/ask';
import { OAT, harness } from './harness';

it('answers a question about the product in view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');   // no prompt is current, and the oat drink is in view
  h.yes('touch');
  expect(h.lines()).toEqual(['ask.listening']);
  h.send({ type: 'question', text: 'Does it contain nuts?' });
  expect(h.effects).toEqual([{ type: 'ask', question: 'Does it contain nuts?', product: h.ctx.catalog.get(OAT) }]);
  h.send({ type: 'answer', text: 'The data lists gluten only.' });
  expect(h.speak()).toMatchObject({ line: { key: 'ask.answer', text: 'The data lists gluten only.' }, priority: 'low' });
});
it('ignores a question outside the window, and says so when no product is known', () => {
  const h = harness();
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.effects).toEqual([]);
  h.yes('touch'); h.advance(ASK_WINDOW_MS);
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.effects).toEqual([]);
  h.yes('touch');
  h.send({ type: 'question', text: 'What is this?' });
  expect(h.lines()).toEqual(['ask.noProduct']);
});
it('says that it could not answer', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head'); h.yes('touch');
  h.send({ type: 'question', text: 'Is it organic?' });
  h.send({ type: 'answer', text: null });
  expect(h.lines()).toEqual(['ask.failed']);
});
it('a double tap still answers a prompt', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('touch');
  expect(h.state.cart.totalCents).toBe(189);
  expect(h.state.askUntil).toBeNull();
});
it('the microphone button opens the question window, also while a prompt is current', () => {
  const h = harness();
  h.see(OAT); h.done();
  h.intent('ask', 'phone');
  expect(h.lines()).toEqual(['ask.listening']);
  expect(h.state.askUntil).toBe(h.now + ASK_WINDOW_MS);
  h.yes('phone');
  expect(h.state.cart.totalCents).toBe(189);   // the prompt was still current
});
it('a question closes the window, so a second question does nothing', () => {
  const h = harness();
  h.see(OAT); h.intent('ask', 'phone');
  h.send({ type: 'question', text: 'Is it vegan?' });
  expect(h.effects).toHaveLength(1);
  expect(h.state.askUntil).toBeNull();
  h.send({ type: 'question', text: 'Is it vegan?' });
  expect(h.effects).toEqual([]);
});
it('asks about the product of the current prompt first, then the product in view, then the last add', () => {
  const prompt = harness();
  prompt.see(OAT); prompt.intent('ask', 'phone');
  prompt.send({ type: 'question', text: 'q' });
  expect(prompt.effects).toMatchObject([{ type: 'ask', product: { id: OAT } }]);

  const added = harness();
  added.see(OAT); added.done(); added.yes('head');
  added.advance(5000);   // the oat drink has left the view
  added.yes('touch');   // R10 gives its hint one time
  expect(added.lines()).toEqual(['hint.holdAgainForAnother']);
  added.yes('touch');
  expect(added.lines()).toEqual(['ask.listening']);
  added.send({ type: 'question', text: 'q' });
  expect(added.effects).toMatchObject([{ type: 'ask', product: { id: OAT } }]);
});
it('a double tap after an add keeps the hint of R10 and opens no window', () => {
  const h = harness();
  h.see(OAT); h.done(); h.yes('touch'); h.yes('touch');
  expect(h.lines()).toEqual(['hint.holdAgainForAnother']);
  expect(h.state.askUntil).toBeNull();
});
it('a double tap while a prompt plays opens no window', () => {
  const h = harness();
  h.see(OAT); h.yes('touch', 'p-0001');
  expect(h.state.askUntil).toBeNull();
});
it('an answer that arrives after the session ended says nothing', () => {
  const h = harness();
  h.see(OAT); h.intent('ask', 'phone'); h.send({ type: 'question', text: 'q' });
  h.intent('stop', 'phone');
  h.send({ type: 'answer', text: 'Late.' });
  expect(h.effects).toEqual([]);
});
it('does not ask about a product that has left the view', () => {
  const h = harness();
  h.see(OAT); h.done(); h.no('head');
  h.advance(5000);   // the oat drink has left the view, and the cart got no product
  h.yes('touch');
  h.send({ type: 'question', text: 'Does it contain nuts?' });
  expect(h.lines()).toEqual(['ask.noProduct']);
});
