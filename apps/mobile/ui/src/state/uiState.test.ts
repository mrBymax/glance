import { DEFAULT_PROFILE, EMPTY_CART } from '@glance/shared';
import { expect, it } from 'vitest';
import { NATIVE_READY } from '../bridge/fakeNative';
import { EVENT_TYPES, eventFixture, eventMessage, SNAPSHOT } from '../debug/fixtures';
import { initialUiState, reduce, type UiAction } from './uiState';

const run = (...actions: UiAction[]) => actions.reduce(reduce, initialUiState);
const productPrompt = eventMessage('glance.pending');
const payPrompt = eventMessage('checkout.offered');
const added = { kind: 'add', productId: 'oat-drink-1l', name: 'Oat drink' } as const;

it('starts empty', () => {
  expect(initialUiState).toEqual({
    native: null, profile: DEFAULT_PROFILE, sessionId: null, phase: null, prompt: null, lookAlikes: null, spotCheck: null,
    cart: EMPTY_CART, cartSeq: 0, captions: [], receipt: null, checkout: 'none', budget: null, error: null,
  });
});
it('shows a pending glance as the product prompt', () => {
  expect(run(eventMessage('glance.pending', { kind: 'inCart' })).prompt).toMatchObject({
    kind: 'product', mode: 'inCart', promptId: 'p-0001', product: { id: 'oat-drink-1l', packSize: '1 L', priceCents: 189 },
  });
});
it('clears the prompt for its own ID only', () => {
  expect(run(productPrompt, eventMessage('glance.cleared', { promptId: 'p-0001' })).prompt).toBeNull();
  expect(run(productPrompt, eventMessage('glance.cleared', { promptId: 'p-0000' })).prompt).not.toBeNull();
});
it('takes the cart of the server, and counts each change', () => {
  const state = run(eventMessage('cart.updated', { change: added }), eventMessage('cart.updated', { change: null }));
  expect(state.cart).toEqual(eventFixture('cart.updated').cart);
  expect(state.cart.totalCents).toBe(449);
  expect(state.cartSeq).toBe(1);
});
it('opens checkout with the pay prompt', () => {
  expect(run(payPrompt)).toMatchObject({
    checkout: 'offered',
    prompt: { kind: 'pay', promptId: 'p-0001', kiosk: { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' } },
  });
});
it('suspends checkout, and keeps a product prompt that came first', () => {
  expect(run(payPrompt, eventMessage('checkout.suspended'))).toMatchObject({ checkout: 'suspended', prompt: null });
  expect(run(payPrompt, productPrompt, eventMessage('checkout.suspended')).prompt).toMatchObject({ kind: 'product' });
});
it('keeps the receipt after the payment', () => {
  const { type, ...receipt } = eventFixture('checkout.paid');
  expect(run(payPrompt, eventMessage('checkout.paid'))).toMatchObject({ checkout: 'paid', prompt: null, receipt });
});
it('marks a failed payment until the next glance, and a cancelled checkout', () => {
  expect(run(payPrompt, eventMessage('checkout.failed'))).toMatchObject({ checkout: 'failed', prompt: null });
  expect(run(payPrompt, eventMessage('checkout.failed'), productPrompt).checkout).toBe('none');
  expect(run(payPrompt, eventMessage('checkout.cancelled'))).toMatchObject({ checkout: 'none', prompt: null });
});
it('keeps the last 20 captions, and one caption for each ID', () => {
  const caption = (n: number, text = `Line ${n}`) => eventMessage('caption', { id: `c-${n}`, text });
  const state = run(...Array.from({ length: 25 }, (_, n) => caption(n)), caption(24, 'Line 24 again'));
  expect(state.captions).toHaveLength(20);
  expect(state.captions[0]?.id).toBe('c-5');
  expect(state.captions.at(-1)?.text).toBe('Line 24 again');
});
it('stores look-alike products until the next prompt', () => {
  expect(run(eventMessage('glance.ambiguous')).lookAlikes).toEqual(eventFixture('glance.ambiguous').candidates);
  expect(run(eventMessage('glance.ambiguous'), productPrompt).lookAlikes).toBeNull();
});
it('stores the product of a spot check', () => {
  expect(run(eventMessage('checkout.spotcheck'))).toMatchObject({ checkout: 'spotcheck', spotCheck: eventFixture('checkout.spotcheck').product });
});
it('keeps a budget warning until the total is within the budget', () => {
  expect(run(eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }), eventMessage('cart.updated')).budget).toEqual({ budgetCents: 400, totalCents: 449 });
  expect(run(eventMessage('budget.exceeded', { budgetCents: 500, totalCents: 520 }), eventMessage('cart.updated')).budget).toBeNull();
});
it('keeps an error until a sign of recovery', () => {
  const failed = run({ t: 'native.state', state: NATIVE_READY }, eventMessage('error'));
  expect(failed.error).toEqual({ code: eventFixture('error').code, message: eventFixture('error').message });
  expect(reduce(failed, eventMessage('caption')).error).not.toBeNull();
  expect(reduce(failed, eventMessage('session.state')).error).not.toBeNull();
  expect(reduce(failed, { t: 'native.state', state: { ...NATIVE_READY, session: 'stopped', device: null } }).error).not.toBeNull();
  expect(reduce(failed, productPrompt).error).toBeNull();
  expect(reduce(failed, { t: 'native.state', state: { ...NATIVE_READY, stream: 'streaming' } }).error).toBeNull();
  expect(reduce(failed, { t: 'local.attempt' }).error).toBeNull();
});
it('replaces the session data from a snapshot', () => {
  const state = run(productPrompt, { t: 'snapshot', session: SNAPSHOT });
  expect(state).toMatchObject({
    sessionId: SNAPSHOT.sessionId, phase: SNAPSHOT.phase, prompt: SNAPSHOT.prompt, cart: SNAPSHOT.cart,
    profile: SNAPSHOT.profile, receipt: SNAPSHOT.lastReceipt,
  });
  expect(state.captions).toEqual(SNAPSHOT.captions.slice(-20));
});
it('reads the checkout state of a snapshot from its prompt and its phase', () => {
  const { type, ...receipt } = eventFixture('checkout.paid');
  const { type: _type, ...pay } = eventFixture('checkout.offered');
  const snapshot = (change: Partial<typeof SNAPSHOT>): UiAction => ({ t: 'snapshot', session: { ...SNAPSHOT, ...change } });
  expect(run(snapshot({ phase: 'checkout', prompt: { ...pay, kind: 'pay' } })).checkout).toBe('offered');
  expect(run(snapshot({ phase: 'paid', prompt: null, lastReceipt: receipt })).checkout).toBe('paid');
  expect(run(payPrompt, snapshot({})).checkout).toBe('none');
});
it('keeps the newer product prompt when an older prompt is cleared or the checkout stops', () => {
  const newer = eventMessage('glance.pending', { promptId: 'p-0002' });
  const state = run(payPrompt, newer, eventMessage('glance.cleared', { promptId: 'p-0001' }), eventMessage('checkout.cancelled'));
  expect(state.prompt).toMatchObject({ kind: 'product', promptId: 'p-0002' });
});
it('keeps the native state and the profile on a local reset', () => {
  const state = run({ t: 'native.state', state: NATIVE_READY }, { t: 'local.profile', patch: { detail: 'brief' } },
    eventMessage('cart.updated'), { t: 'local.reset' });
  expect(state).toEqual({ ...initialUiState, native: NATIVE_READY, profile: { ...DEFAULT_PROFILE, detail: 'brief' } });
});
it('accepts each of the 16 event fixtures', () => {
  expect(EVENT_TYPES).toHaveLength(16);
  for (const type of EVENT_TYPES) expect(() => run(eventMessage(type))).not.toThrow();
});
it('drops the budget warning when the shopper raises or removes the budget', () => {
  const over = run(eventMessage('cart.updated'), eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }));
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 500 } }).budget).toBeNull();
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: null } }).budget).toBeNull();
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 300 } }).budget).not.toBeNull();
});
it('keeps the budget warning only while the new budget is under the total', () => {
  const over = run(eventMessage('cart.updated'), eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }));
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 449 } }).budget).toBeNull();
  expect(reduce(over, { t: 'local.profile', patch: { budgetCents: 448 } }).budget).toEqual({ budgetCents: 448, totalCents: 449 });
  expect(reduce(over, { t: 'local.profile', patch: { detail: 'brief' } }).budget).toEqual({ budgetCents: 400, totalCents: 449 });
});
it('treats the profile of the host as a budget change', () => {
  const over = run(eventMessage('cart.updated'), eventMessage('budget.exceeded', { budgetCents: 400, totalCents: 449 }));
  expect(reduce(over, { t: 'profile', profile: { ...DEFAULT_PROFILE, budgetCents: null } }).budget).toBeNull();
  expect(reduce(over, { t: 'profile', profile: { ...DEFAULT_PROFILE, budgetCents: 2000 } }).budget).toBeNull();
  expect(reduce(over, { t: 'profile', profile: { ...DEFAULT_PROFILE, budgetCents: 400 } }).budget).not.toBeNull();
});
