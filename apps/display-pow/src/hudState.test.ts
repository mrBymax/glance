import { describe, expect, it } from 'vitest';
import type { ServerEvent, SessionSnapshot } from '@glance/shared';
import { DEFAULT_PROFILE, parseServerEvent } from '@glance/shared';
import { INITIAL_HUD_STATE, hudFromSnapshot, hudView, mockAnswer, reduceHud } from './hudState';

const oat = { id: 'oat-drink-1l', name: 'Oat drink', packSize: '1 L', priceCents: 189 };
const rye = { id: 'rye-bread', name: 'Rye bread', packSize: '500 g', priceCents: 260 };
const ryeCart = { items: [{ productId: 'rye-bread', name: 'Rye bread', packSize: '500 g', qty: 1, unitPriceCents: 260 }], totalCents: 260 };
const cameraOn: ServerEvent = { type: 'session.state', phase: 'shopping', cameraOn: true };
const pending = (promptId: string, product = oat, extra: object = {}): ServerEvent =>
  ({ type: 'glance.pending', promptId, kind: 'new', product, warnings: [], qtyInCart: 0, ...extra });
const run = (...events: ServerEvent[]) => events.reduce(reduceHud, INITIAL_HUD_STATE);

describe('hudView', () => {
  it('starts with the camera off and no answer', () => {
    expect(hudView(INITIAL_HUD_STATE)).toEqual({
      cameraLabel: 'Camera off', title: 'No product in view', price: null, warnings: [], prompt: 'Start the camera on your phone.',
      total: '0.00 EUR, 0 items', caption: null, canAnswer: false, yesTitle: 'Add', noTitle: 'Skip' });
  });
  it('shows the idle text while the camera runs', () => {
    expect(hudView(run(cameraOn))).toMatchObject({
      cameraLabel: 'Camera on', title: 'No product in view', prompt: 'Hold a product up to hear its price.', canAnswer: false });
  });
  it('shows the pending product with price, warning, and prompt', () => {
    const view = hudView(run(cameraOn, pending('p-1', oat, { warnings: [{ kind: 'allergen', allergens: ['gluten', 'milk'] }] })));
    expect(view).toMatchObject({ title: 'Oat drink, 1 L', price: '1.89 EUR', warnings: ['Warning: contains gluten, milk.'],
      prompt: 'Add to cart?', canAnswer: true, noTitle: 'Skip' });
  });
  it('names missing allergen data and a diet warning', () => {
    const view = hudView(run(cameraOn, pending('p-1', oat, { warnings: [{ kind: 'allergenDataMissing' }, { kind: 'diet', diet: 'vegan' }] })));
    expect(view.warnings).toEqual(['Allergen data is missing for this product.', 'Warning: not vegan.']);
  });
  it('offers Remove for a product that is in the cart', () => {
    const view = hudView(run(cameraOn, pending('p-1', rye, { kind: 'inCart', qtyInCart: 1 })));
    expect(view).toMatchObject({ prompt: '1 in your cart. Add another?', noTitle: 'Remove' });
  });
  it('shows the total, the item count, and the last caption', () => {
    const caption: ServerEvent = { type: 'caption', id: 'c-1', text: 'Added rye bread. Total two sixty.', lang: 'en', priority: 'normal', url: null };
    expect(hudView(run({ type: 'cart.updated', cart: ryeCart, change: null }, caption))).toMatchObject({
      total: '2.60 EUR, 1 item', caption: 'Added rye bread. Total two sixty.' });
  });
});

describe('reduceHud', () => {
  it('lets a newer product replace the pending product', () => {
    expect(run(cameraOn, pending('p-1'), pending('p-2', rye)).pending?.promptId).toBe('p-2');
  });
  it('ignores a clear for an older prompt', () => {
    expect(run(cameraOn, pending('p-1'), pending('p-2', rye), { type: 'glance.cleared', promptId: 'p-1' }).pending?.promptId).toBe('p-2');
  });
  it('clears the product on a clear, an unknown product, a checkout, and a stopped camera', () => {
    const base = run(cameraOn, pending('p-1'));
    const offered: ServerEvent = { type: 'checkout.offered', promptId: 'p-9', kiosk: { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' },
      totalCents: 260, itemCount: 1, needsBiometric: false };
    for (const event of [{ type: 'glance.cleared', promptId: 'p-1' }, { type: 'glance.unknown' }, offered,
      { type: 'session.state', phase: 'resting', cameraOn: false }] as ServerEvent[]) {
      expect(reduceHud(base, event).pending).toBeNull();
    }
  });
  it('builds the same state from a snapshot', () => {
    const snapshot: SessionSnapshot = { sessionId: 's-1', phase: 'shopping', cameraOn: true,
      prompt: { promptId: 'p-1', kind: 'product', mode: 'inCart', product: rye, warnings: [], qtyInCart: 1 },
      cart: ryeCart, profile: DEFAULT_PROFILE, kiosk: null, lastReceipt: null,
      captions: [{ id: 'c-1', text: 'Camera on.', lang: 'en', priority: 'normal', url: null }] };
    expect(hudFromSnapshot(snapshot)).toEqual({ cameraOn: true,
      pending: { promptId: 'p-1', mode: 'inCart', product: rye, warnings: [], qtyInCart: 1 }, cart: ryeCart, caption: 'Camera on.' });
  });
});

describe('mockAnswer', () => {
  it('adds one unit of the pending product and clears the prompt', () => {
    const state = run(cameraOn, { type: 'cart.updated', cart: ryeCart, change: null }, pending('p-2'));
    const events = mockAnswer(state, 'yes');
    expect(events.map((e) => e.type)).toEqual(['glance.cleared', 'cart.updated', 'caption']);
    expect(hudView(events.reduce(reduceHud, state))).toMatchObject({
      total: '4.49 EUR, 2 items', caption: 'Added: Oat drink. Total 4.49 EUR.', canAnswer: false });
  });
  it('skips a new product with no cart change', () => {
    const events = mockAnswer(run(cameraOn, pending('p-1')), 'no');
    expect(events.map((e) => e.type)).toEqual(['glance.cleared', 'caption']);
  });
  it('removes one unit when the answer is no for a product in the cart', () => {
    const state = run(cameraOn, { type: 'cart.updated', cart: ryeCart, change: null }, pending('p-3', rye, { kind: 'inCart', qtyInCart: 1 }));
    expect(hudView(mockAnswer(state, 'no').reduce(reduceHud, state))).toMatchObject({
      total: '0.00 EUR, 0 items', caption: 'Removed: Rye bread. Total 0.00 EUR.' });
  });
  it('returns nothing when no product is pending', () => {
    expect(mockAnswer(run(cameraOn), 'yes')).toEqual([]);
  });
});

describe('rules of the plan text with no plan test', () => {
  const kiosk = { id: 'kiosk-1', name: 'Checkout 3', store: 'Demo Market' };
  const twoRye = { items: [{ ...ryeCart.items[0]!, qty: 2 }], totalCents: 520 };
  const withCart = (cart: typeof ryeCart, ...events: ServerEvent[]) => run(cameraOn, { type: 'cart.updated', cart, change: null }, ...events);
  const ryeInCart = (qty: number) => pending('p-3', rye, { kind: 'inCart', qtyInCart: qty });

  it('clears the product on an ambiguous product and on a paid checkout', () => {
    const base = run(cameraOn, pending('p-1'));
    const paid: ServerEvent = { type: 'checkout.paid', orderId: 'o-1', totalCents: 260, paidAt: '2026-11-14T10:00:00Z', items: ryeCart.items, kiosk };
    expect(reduceHud(base, { type: 'glance.ambiguous', candidates: [oat, rye] }).pending).toBeNull();
    expect(reduceHud(base, paid).pending).toBeNull();
  });
  it('shows the message of an error as the caption', () => {
    expect(run(cameraOn, { type: 'error', code: 'glasses.disconnected', message: 'The glasses are not connected.' }).caption)
      .toBe('The glasses are not connected.');
  });
  it('keeps its state for an event that changes no part of the HUD', () => {
    const base = run(cameraOn, pending('p-1'));
    for (const event of [{ type: 'glance.hint', aimHint: 'left' }, { type: 'budget.exceeded', budgetCents: 100, totalCents: 260 },
      { type: 'checkout.suspended' }, { type: 'checkout.cancelled' }, { type: 'checkout.failed', reason: 'declined' }] as ServerEvent[]) {
      expect(reduceHud(base, event)).toBe(base);
    }
  });
  it('keeps the product of a snapshot when a clear for an older prompt arrives after it', () => {
    const snapshot: SessionSnapshot = { sessionId: 's-1', phase: 'shopping', cameraOn: true,
      prompt: { promptId: 'p-2', kind: 'product', mode: 'new', product: rye, warnings: [], qtyInCart: 0 },
      cart: ryeCart, profile: DEFAULT_PROFILE, kiosk: null, lastReceipt: null, captions: [] };
    const state = hudFromSnapshot(snapshot);
    expect(state.caption).toBeNull();
    expect(reduceHud(state, { type: 'glance.cleared', promptId: 'p-1' }).pending?.promptId).toBe('p-2');
  });
  it('has no pending product for a pay prompt, and takes the last caption of a snapshot', () => {
    const caption = (id: string, text: string) => ({ id, text, lang: 'en' as const, priority: 'normal' as const, url: null });
    const snapshot: SessionSnapshot = { sessionId: 's-1', phase: 'checkout', cameraOn: true,
      prompt: { promptId: 'p-9', kind: 'pay', kiosk, totalCents: 260, itemCount: 1, needsBiometric: false },
      cart: ryeCart, profile: DEFAULT_PROFILE, kiosk, lastReceipt: null,
      captions: [caption('c-1', 'Camera on.'), caption('c-2', 'Checkout 3. Nod to pay.')] };
    expect(hudFromSnapshot(snapshot)).toMatchObject({ pending: null, caption: 'Checkout 3. Nod to pay.' });
    expect(hudView(hudFromSnapshot(snapshot)).canAnswer).toBe(false);
  });
  it('counts each unit of a line in the item count', () => {
    expect(hudView(withCart(twoRye)).total).toBe('5.20 EUR, 2 items');
  });
  it('adds a unit to the line of a product that is in the cart, and names the change', () => {
    const events = mockAnswer(withCart(ryeCart, ryeInCart(1)), 'yes');
    expect(events).toEqual([
      { type: 'glance.cleared', promptId: 'p-3' },
      { type: 'cart.updated', cart: twoRye, change: { kind: 'add', productId: 'rye-bread', name: 'Rye bread' } },
      { type: 'caption', id: 'mock-p-3-yes', text: 'Added: Rye bread. Total 5.20 EUR.', lang: 'en', priority: 'normal', url: null },
    ]);
  });
  it('removes one unit of two, and removes the line at 0', () => {
    expect(mockAnswer(withCart(twoRye, ryeInCart(2)), 'no')[1]).toEqual(
      { type: 'cart.updated', cart: ryeCart, change: { kind: 'remove', productId: 'rye-bread', name: 'Rye bread' } });
    expect(mockAnswer(withCart(ryeCart, ryeInCart(1)), 'no')[1]).toMatchObject({ cart: { items: [], totalCents: 0 } });
  });
  it('changes no cart for a no on a new product, and for a no on a product with no line in the cart', () => {
    const skipped = [{ type: 'glance.cleared', promptId: 'p-3' },
      { type: 'caption', id: 'mock-p-3-no', text: 'Skipped.', lang: 'en', priority: 'normal', url: null }];
    expect(mockAnswer(withCart(ryeCart, pending('p-3', rye)), 'no')).toEqual(skipped);
    expect(mockAnswer(run(cameraOn, ryeInCart(1)), 'no')).toEqual(skipped);
  });
  it('gives only events that the shared schema accepts', () => {
    for (const event of [...mockAnswer(withCart(ryeCart, ryeInCart(1)), 'yes'), ...mockAnswer(withCart(ryeCart, ryeInCart(1)), 'no')]) {
      expect(parseServerEvent(event)).toEqual(event);
    }
  });
});
