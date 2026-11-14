import { expect, it } from 'vitest';
import { TIMING as T } from '@glance/shared';
import { NO_RESULT } from '../recognition/result';
import {
  CODE_FRAMES_WITHIN_MS, CODE_QUIET_MS, STILLS_BEFORE_WAIT, STILL_REQUEST_EVERY_MS, STILL_REQUEST_WAIT_MS, UNREADABLE_EVERY_MS,
} from './code';
import { type Harness, KIOSK, OAT, RYE, harness, product } from './harness';
import { step } from './step';
import type { BarcodeOutcome, SessionState } from './types';

const NUTELLA = 'gtin-3017624010701';
const SPAGHETTI = 'gtin-8076800195057';
const scanned = () => harness({ products: [product(NUTELLA, 399), product(SPAGHETTI, 109)] });
const found = (productId: string): BarcodeOutcome => ({ kind: 'product', productId });
const missing = (gtin = '4006381333931'): BarcodeOutcome => ({ kind: 'notInStore', gtin });
const code = (h: Harness, digits: string | null = null) => h.result({ code: { visible: true, digits } });
/** The barcode report of the phone: one time each second while the code is in view. */
function holdCode(h: Harness, outcome: BarcodeOutcome, ms: number): void {
  h.barcode(outcome);
  for (let elapsed = 1000; elapsed <= ms; elapsed += 1000) {
    h.advance(1000);
    h.barcode(outcome);
  }
}

it('a scanned product gets the prompt of an identified product, with the price of the store', () => {
  const h = scanned();
  h.barcode(found(NUTELLA));
  expect(h.state.prompt).toEqual({ id: 'p-0001', kind: 'product', mode: 'new', productId: NUTELLA, doneAt: null });
  expect(h.event('glance.pending')).toMatchObject({ kind: 'new', product: { id: NUTELLA, priceCents: 399 }, qtyInCart: 0 });
  expect(h.speak()).toMatchObject({ line: { key: 'glance.new', hint: true }, promptId: 'p-0001' });
});
it('R1: the reports of one appearance give one prompt, and a code that comes back gets a new one', () => {
  const h = scanned();
  holdCode(h, found(NUTELLA), 5000);
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
  h.advance(T.viewMs); h.barcode(found(NUTELLA));
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
});
it('a yes adds the scanned product at the price of the store, and a second scan offers one more', () => {
  const h = scanned();
  h.barcode(found(NUTELLA)); h.done(); h.yes();
  expect(h.state.cart).toEqual({
    items: [{ productId: NUTELLA, name: `Test ${NUTELLA}`, packSize: '1 pc', qty: 1, unitPriceCents: 399 }], totalCents: 399,
  });
  expect(h.lines()).toEqual(['cart.added']);
  h.advance(T.viewMs); h.barcode(found(NUTELLA));
  expect(h.event('glance.pending')).toMatchObject({ kind: 'inCart', qtyInCart: 1 });
});
it('R8, R9: after a no, the code gets no prompt while it stays in view and for 10 seconds', () => {
  const h = scanned();
  h.barcode(found(NUTELLA)); h.done(); h.no();
  expect(h.lines()).toEqual(['glance.skipped']);
  holdCode(h, found(NUTELLA), 4000);
  expect(h.state.prompt).toBeNull();
  h.advance(T.excludeAfterNoMs); h.barcode(found(NUTELLA));
  expect(h.state.prompt).toMatchObject({ productId: NUTELLA });
});
it('R2: a scanned product replaces the pending product, and a product in sight replaces a scanned one', () => {
  const h = scanned();
  h.see(OAT); h.barcode(found(NUTELLA));
  expect(h.events()).toEqual(['glance.cleared', 'glance.pending']);
  h.see(RYE);
  expect(h.state.prompt).toMatchObject({ productId: RYE });
});
it('a product ID that no index holds gives nothing', () => {
  const h = harness();
  h.barcode(found(NUTELLA));
  expect(h.effects).toEqual([]);
  expect(h.state.prompt).toBeNull();
});
it('R17: a scanned product suspends the checkout', () => {
  const h = harness({ products: [product(NUTELLA, 399)], cart: [OAT] });
  h.kiosk(); h.barcode(found(NUTELLA));
  expect(h.events()).toEqual(['checkout.suspended', 'glance.pending']);
  expect(h.state.checkout).toMatchObject({ step: 'suspended', suspendedBy: NUTELLA });
});
it('a scanned product passes the spot check', () => {
  const h = harness({ products: [product(NUTELLA, 399)], cart: [OAT, NUTELLA] });
  h.kiosk({ spotCheck: true });
  expect(h.state.checkout).toMatchObject({ step: 'spotcheck', spotProductId: NUTELLA });
  h.barcode(found(NUTELLA));
  expect(h.lines()).toEqual(['spotcheck.thanks']);
});
it('a barcode gives nothing while the payment runs, and in a session that ended', () => {
  const h = harness({ products: [product(NUTELLA, 399)], cart: [OAT] });
  h.kiosk(); h.done(); h.yes();
  expect(h.state.checkout?.step).toBe('paying');
  h.barcode(found(NUTELLA)); expect(h.effects).toEqual([]);
  h.barcode(missing()); expect(h.effects).toEqual([]);
  const ended = scanned();
  ended.intent('stop'); ended.barcode(found(NUTELLA));
  expect(ended.effects).toEqual([]);
});

it('a code that the store does not sell gets its line one time for each appearance, and no prompt', () => {
  const h = scanned();
  h.barcode(missing());
  expect(h.lines()).toEqual(['barcode.notInStore']);
  expect(h.speak()).toMatchObject({ priority: 'normal', interrupt: false, sound: null, promptId: null });
  expect(h.events()).toEqual([]);
  expect(h.state.prompt).toBeNull();
  holdCode(h, missing(), 5000);
  expect(h.all.filter((e) => e.type === 'speak')).toHaveLength(1);
  h.advance(T.viewMs); h.barcode(missing());
  expect(h.lines()).toEqual(['barcode.notInStore']);
});
it('another code that the store does not sell gets the line at once', () => {
  const h = scanned();
  h.barcode(missing()); h.advance(1000); h.barcode(missing('4006381333948'));
  expect(h.lines()).toEqual(['barcode.notInStore']);
});
it('the line for a code that the store does not sell waits while the product of a prompt is in view', () => {
  const h = scanned();
  h.barcode(found(NUTELLA)); h.advance(1000); h.barcode(missing());
  expect(h.effects).toEqual([]);
  h.advance(T.viewMs - 1000); h.barcode(missing());
  expect(h.lines()).toEqual(['barcode.notInStore']);
  expect(h.state.prompt).toMatchObject({ productId: NUTELLA });
});
it('an invalid code gives nothing', () => {
  const h = scanned();
  h.barcode({ kind: 'invalid' });
  expect(h.effects).toEqual([]);
  h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
});
it('R22: barcode reports keep the camera on', () => {
  const h = scanned();
  h.send({ type: 'device.state', state: { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream: 'streaming' } });
  h.advance(T.restAfterIdleMs - 1000); h.barcode(missing());
  h.advance(2000);
  expect(h.state.phase).toBe('shopping');
});

it('one voice: no unknown line and no aim hint while barcode reports arrive, and for 3 seconds after', () => {
  const h = scanned();
  h.barcode(missing());
  h.advance(500); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
  h.advance(500); h.result({ status: 'unsure', aimHint: 'turn' });
  expect(h.effects).toEqual([]);
  h.advance(500); h.barcode(missing());
  h.advance(CODE_QUIET_MS - 1); h.result({ status: 'unsure', aimHint: 'turn' });
  expect(h.effects).toEqual([]);
  h.advance(1); h.result({ status: 'unsure', aimHint: 'turn' });
  expect(h.lines()).toEqual(['glance.partial']);
});
it('one voice: a frame with a visible code is quiet too, also with the status unknown', () => {
  const h = scanned();
  h.result({ status: 'unknown', code: { visible: true, digits: null } });
  expect(h.effects).toEqual([]);
  h.advance(CODE_QUIET_MS); h.result({ status: 'unknown' });
  expect(h.lines()).toEqual(['glance.unknown']);
});
it('one voice: a label frame is quiet from its arrival', () => {
  const h = scanned();
  h.label('started');
  expect(h.effects).toEqual([]);
  h.advance(CODE_QUIET_MS - 1); h.result({ status: 'unknown' });
  expect(h.effects).toEqual([]);
});

it('a label frame that gave no product gets the unreadable line, at most one time each 10 seconds', () => {
  const h = scanned();
  h.label('started'); h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
  expect(h.speak()).toMatchObject({ priority: 'normal', interrupt: false, promptId: null });
  h.advance(UNREADABLE_EVERY_MS - 1); h.label('failed');
  expect(h.effects).toEqual([]);
  h.advance(1); h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
});

it('a still that showed no product gets no line, also after the 10 seconds of the unreadable line', () => {
  const h = scanned();
  h.label('started'); h.label('empty');
  expect(h.effects).toEqual([]);
  h.advance(UNREADABLE_EVERY_MS); h.label('started'); h.label('empty');
  expect(h.effects).toEqual([]);
  // The empty still does not use the turn of the unreadable line.
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
});
it('a code that the model sees in 2 frames inside 2 seconds asks the phone for a still', () => {
  const h = scanned();
  code(h);
  expect(h.effects).toEqual([]);
  h.advance(CODE_FRAMES_WITHIN_MS - 1); code(h);
  expect(h.effects).toEqual([{ type: 'still.request' }]);
});
it('2 frames with a code that are 2 seconds apart ask for no still', () => {
  const h = scanned();
  code(h); h.advance(CODE_FRAMES_WITHIN_MS); code(h);
  expect(h.effects).toEqual([]);
  h.advance(500); code(h);
  expect(h.effects).toEqual([{ type: 'still.request' }]);
});
it('asks for a still at most one time each 6 seconds', () => {
  const h = scanned();
  const requests = () => h.all.filter((effect) => effect.type === 'still.request').length;
  for (let elapsed = 0; elapsed < STILL_REQUEST_EVERY_MS + 500; elapsed += 500) {
    code(h);
    h.advance(500);
  }
  expect(requests()).toBe(1);
  code(h);
  expect(requests()).toBe(2);
});
it('asks for no still while a code was accepted in the last 3 seconds', () => {
  const h = scanned();
  h.barcode(found(NUTELLA));
  code(h); h.advance(500); code(h);
  expect(h.effects).toEqual([]);
  h.advance(1000); h.barcode(missing());
  h.advance(2500); code(h); h.advance(400); code(h);
  expect(h.effects).toEqual([]);
  h.advance(100); code(h);
  expect(h.effects).toEqual([{ type: 'still.request' }]);
});
it('asks for no still while the payment runs', () => {
  const h = harness({ cart: [OAT] });
  h.kiosk(); h.done(); h.yes();
  code(h); h.advance(500); code(h);
  expect(h.effects).toEqual([]);
});
it('a frame with no code between two frames with a code does not start the count again', () => {
  const h = scanned();
  code(h); h.advance(500); h.result({}); h.advance(500); code(h);
  expect(h.effects).toEqual([{ type: 'still.request' }]);
});

it('a session that an older server stored has no code state, and takes each input', () => {
  const h = scanned();
  const { code: _code, ...old } = h.state;
  const run = (state: SessionState, input: Parameters<typeof step>[1]) => step(state, input, h.ctx);
  expect(run(old as SessionState, { type: 'barcode', outcome: missing(), now: h.now }).effects).toHaveLength(1);
  expect(run(old as SessionState, { type: 'label', read: 'failed', now: h.now }).effects).toHaveLength(1);
  expect(run(old as SessionState, { type: 'tick', now: h.now }).state.code).toBeUndefined();
  const seen = run(old as SessionState, { type: 'recognition', result: { ...NO_RESULT, status: 'unknown' }, still: false, now: h.now });
  expect(seen.effects).toHaveLength(2);
});
it('keeps the kiosk rules: a pay prompt does not open while a scanned product has its prompt', () => {
  const h = harness({ products: [product(NUTELLA, 399)], cart: [OAT] });
  h.barcode(found(NUTELLA));
  h.send({ type: 'kiosk.seen', kiosk: KIOSK, busy: false, spotCheck: false });
  expect(h.state.checkout).toBeNull();
});

it('R9: after a no, a code that left the view and comes back inside 10 seconds gets no prompt', () => {
  const h = scanned();
  h.barcode(found(NUTELLA)); h.done(); h.no();
  h.advance(T.viewMs + 1000); h.barcode(found(NUTELLA));
  expect(h.state.prompt).toBeNull();
  expect(h.effects).toEqual([]);
});
it('a session that rests takes no barcode and no label frame', () => {
  const h = scanned();
  h.state = { ...h.state, phase: 'resting' };
  h.barcode(found(NUTELLA)); expect(h.effects).toEqual([]);
  h.barcode(missing()); expect(h.effects).toEqual([]);
  h.label('failed'); expect(h.effects).toEqual([]);
  expect(h.state.phase).toBe('resting');
});
it('a label frame that gave no product gets no line while the payment runs', () => {
  const h = harness({ cart: [OAT] });
  h.kiosk(); h.done(); h.yes();
  h.label('started'); h.label('failed');
  expect(h.effects).toEqual([]);
});
it('the times of the design', () => {
  expect([CODE_QUIET_MS, CODE_FRAMES_WITHIN_MS, STILL_REQUEST_EVERY_MS, UNREADABLE_EVERY_MS]).toEqual([3000, 2000, 6000, 10000]);
});
it('after 2 stills with no code read, the next still waits 30 seconds, so a code that no reader can read does not stop Motion each 6 seconds', () => {
  expect([STILLS_BEFORE_WAIT, STILL_REQUEST_WAIT_MS]).toEqual([2, 30000]);
  const h = scanned();
  const times: number[] = [];
  const start = h.now;
  for (let elapsed = 0; elapsed <= 70000; elapsed += 500) {
    code(h);
    if (h.effects.some((effect) => effect.type === 'still.request')) times.push(h.now - start);
    h.advance(500);
  }
  expect(times).toEqual([500, 6500, 36500, 66500]);
});
it('a code that was read ends the long wait for the next still', () => {
  const h = scanned();
  const requests = () => h.all.filter((effect) => effect.type === 'still.request').length;
  for (let elapsed = 0; elapsed < 8000; elapsed += 500) { code(h); h.advance(500); }
  expect(requests()).toBe(2);
  h.barcode(missing());
  h.advance(STILL_REQUEST_EVERY_MS); code(h); h.advance(500); code(h);
  expect(requests()).toBe(3);
});
