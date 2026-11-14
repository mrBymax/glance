import { expect, it } from 'vitest';
import { TIMING } from '@glance/shared';
import { APPEARANCE_EMPTY_MS, LINE_KIND, SAME_TEXT_MS, UNSOLICITED_GAP_MS, isSolicited } from './guard';
import { BARISTA, type Harness, OAT, RYE, STREAMING, harness } from './harness';
import { LINE_DEFAULTS } from './say';
import type { Effect } from './types';

const NOT_SOLD = { kind: 'notInStore', gtin: '4006381333931' } as const;
const ALSO_NOT_SOLD = { kind: 'notInStore', gtin: '5449000000996' } as const;

type Dropped = Extract<Effect, { type: 'speak.dropped' }>;
const dropped = (h: Harness) => h.effects
  .filter((effect): effect is Dropped => effect.type === 'speak.dropped')
  .map((effect) => [effect.line.key, effect.reason]);

/** Each line key since the start of the harness. */
const spokenIn = (h: Harness) => h.all.flatMap((effect) => (effect.type === 'speak' ? [effect.line.key] : []));

/** Holds a product that sight cannot name, until the server asked for a still. */
function holdUnknown(h: Harness): void {
  h.result({ status: 'unknown' });
  h.advance(500);
  h.result({ status: 'unknown' });
}

it('has the three times of the guard', () => {
  expect(SAME_TEXT_MS).toBe(20_000);
  expect(UNSOLICITED_GAP_MS).toBe(3000);
  expect(APPEARANCE_EMPTY_MS).toBe(TIMING.viewMs);
});
it('gives each line a kind, and only a prompt, a checkout line, and a state line always play', () => {
  expect(Object.keys(LINE_KIND).sort()).toEqual(Object.keys(LINE_DEFAULTS).sort());
  const always = Object.entries(LINE_KIND).filter(([, kind]) => kind === 'prompt' || kind === 'checkout' || kind === 'state').map(([key]) => key);
  expect(always.sort()).toEqual([
    'checkout.biometric', 'checkout.cancelled', 'checkout.failed', 'checkout.offer', 'checkout.paid',
    'device.battery', 'device.cameraOff', 'device.paused', 'device.regularCheckout',
    'glance.inCart', 'glance.new', 'net.backOnline', 'session.rest', 'session.start', 'spotcheck.ask', 'spotcheck.thanks',
  ]);
  expect(Object.entries(LINE_KIND).filter(([, kind]) => kind === 'attempt').map(([key]) => key).sort()).toEqual(['barcode.unreadable', 'glance.unknown']);
});
it('defines unsolicited in one place: a line is solicited only in the step of an action of the shopper', () => {
  for (const type of ['intent', 'cart.edit', 'profile.set', 'question', 'answer', 'biometric.result'] as const) expect(isSolicited(type), type).toBe(true);
  for (const type of [
    'recognition', 'prompt.done', 'kiosk.seen', 'tick', 'device.state', 'payment.result', 'recognition.slow', 'socket.open', 'barcode', 'label',
  ] as const) expect(isSolicited(type), type).toBe(false);
});

it('does not speak an unsolicited line with the same text again inside 20 seconds', () => {
  const h = harness();
  h.barcode(NOT_SOLD);
  expect(h.lines()).toEqual(['barcode.notInStore']);
  // Another code, after the view was empty: a new appearance for the barcode rule, and the same text.
  h.advance(SAME_TEXT_MS - 1);
  h.barcode(ALSO_NOT_SOLD);
  expect(h.lines()).toEqual([]);
  expect(dropped(h)).toEqual([['barcode.notInStore', 'same text']]);
  h.advance(TIMING.viewMs);
  h.barcode(NOT_SOLD);
  expect(h.lines()).toEqual(['barcode.notInStore']);
});
it('drops an unsolicited line less than 3 seconds after another one, and does not speak it later', () => {
  const h = harness({ cart: [RYE] });
  h.barcode(NOT_SOLD);
  h.advance(UNSOLICITED_GAP_MS - 1);
  const lookAlike = () => h.result({ status: 'ambiguous', candidates: [OAT, BARISTA] });
  lookAlike();
  // The event still goes out. Only the voice is quiet.
  expect(h.events()).toEqual(['glance.ambiguous']);
  expect(h.lines()).toEqual([]);
  expect(dropped(h)).toEqual([['glance.ambiguous', 'gap']]);
  // The products stay in view, and no later step speaks the dropped line.
  for (let ms = 0; ms < 5000; ms += 500) {
    h.advance(500);
    lookAlike();
  }
  expect(spokenIn(h)).toEqual(['barcode.notInStore']);
});
it('speaks an unsolicited line 3 seconds after another one', () => {
  const h = harness({ cart: [RYE] });
  h.barcode(NOT_SOLD);
  h.advance(UNSOLICITED_GAP_MS);
  h.kiosk({ busy: true });
  expect(h.lines()).toEqual(['checkout.busy']);
});
it('a product prompt, a checkout line, and a state line play inside the gap and with the same text', () => {
  const h = harness({ cart: [RYE] });
  h.send({ type: 'device.state', state: STREAMING });
  h.advance(5000);
  h.barcode(NOT_SOLD);
  expect(h.lines()).toEqual(['barcode.notInStore']);
  h.advance(100);
  h.see(OAT);
  expect(h.lines()).toEqual(['glance.new']);
  h.advance(100);
  h.see(BARISTA);
  expect(h.lines()).toEqual(['glance.new']);
  h.advance(100);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 15 } });
  expect(h.lines()).toEqual(['device.battery']);
  h.advance(100);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 15, stream: 'stopped' } });
  expect(h.lines()).toEqual(['device.cameraOff']);
  h.advance(100);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 15 } });
  expect(h.lines()).toEqual(['session.start']);
  // The same text as 100 ms before.
  h.advance(100);
  h.send({ type: 'device.state', state: { ...STREAMING, battery: 15, stream: 'stopped' } });
  expect(h.lines()).toEqual(['device.cameraOff']);
});
it('the pay prompt plays right after another line', () => {
  const h = harness({ cart: [RYE] });
  h.barcode(NOT_SOLD);
  h.advance(100);
  h.kiosk();
  expect(h.lines()).toEqual(['checkout.offer']);
  expect(h.speak()!.sound).toBe('found');
});
it('a line less than 3 seconds after a prompt line is dropped, and a dropped line has no speak effect and so no sound', () => {
  const h = harness();
  h.see(OAT);
  h.advance(1000);
  h.send({ type: 'recognition.slow' });
  expect(h.events()).toEqual(['error']);
  expect(h.speak()).toBeUndefined();
  expect(dropped(h)).toEqual([['recognition.slow', 'gap']]);
});

it('a failed label read speaks one time for one appearance, not one time for each still', () => {
  const h = harness();
  holdUnknown(h);
  h.label('started');
  h.advance(1500);
  h.label('failed');
  expect(h.lines()).toEqual(['glance.unknown']);

  // The shopper keeps the product up. Each 6 seconds a new still fails.
  const spoken: string[] = [];
  for (let still = 0; still < 5; still += 1) {
    for (let ms = 0; ms < 6000; ms += 500) {
      h.advance(500);
      h.result({ status: 'unknown' });
      spoken.push(...h.lines());
    }
    h.label('started');
    h.advance(1500);
    h.label('failed');
    spoken.push(...h.lines());
    expect(dropped(h).map(([, reason]) => reason)).toEqual(['appearance']);
  }
  expect(spoken).toEqual([]);
});
it('speaks about a failed read again after the view was empty for the view time', () => {
  const h = harness();
  holdUnknown(h);
  h.label('started');
  h.advance(1500);
  h.label('failed');
  expect(h.lines()).toEqual(['glance.unknown']);

  // 2999 ms with no product: the same appearance.
  h.advance(APPEARANCE_EMPTY_MS - 1);
  h.label('started');
  h.label('failed');
  expect(h.lines()).toEqual([]);
  expect(dropped(h)).toEqual([['barcode.unreadable', 'appearance']]);

  h.advance(APPEARANCE_EMPTY_MS);
  h.label('started');
  h.advance(1500);
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
});
it('a result with no product and no code keeps the view empty, and a visible code does not', () => {
  const h = harness();
  h.label('started');
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
  for (let ms = 0; ms < 12_000; ms += 500) {
    h.advance(500);
    h.result({ status: 'none', code: { visible: true, digits: null } });
  }
  h.label('started');
  h.label('failed');
  expect(dropped(h)).toEqual([['barcode.unreadable', 'appearance']]);

  for (let ms = 0; ms < 12_000; ms += 500) {
    h.advance(500);
    h.result({ status: 'none' });
  }
  h.label('started');
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
});
it('a product prompt starts a new appearance for the line about a failed read', () => {
  const h = harness();
  h.label('started');
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
  h.advance(1000);
  h.see(OAT);
  expect(h.lines()).toEqual(['glance.new']);
  h.done();
  h.no('phone');
  // The shopper put the oat drink down and holds another product, with no pause. 20 seconds passed, so the text is new again.
  for (let ms = 0; ms < SAME_TEXT_MS; ms += 500) {
    h.advance(500);
    h.result({ status: 'none', code: { visible: true, digits: null } });
  }
  h.label('started');
  h.label('failed');
  expect(h.lines()).toEqual(['barcode.unreadable']);
});

it('never drops a line that answers an action of the shopper', () => {
  const h = harness({ cart: [RYE] });
  h.barcode(NOT_SOLD);
  h.intent('total');
  h.intent('total');
  h.intent('help');
  h.send({ type: 'cart.edit', productId: RYE, qty: 2 });
  h.send({ type: 'cart.edit', productId: RYE, qty: 1 });
  h.send({ type: 'cart.edit', productId: RYE, qty: 2 });
  h.intent('undo');
  h.intent('ask');
  h.send({ type: 'question', text: 'Is it vegan?' });
  h.send({ type: 'answer', text: null });
  h.send({ type: 'answer', text: null });
  expect(spokenIn(h)).toEqual([
    'barcode.notInStore', 'info.total', 'info.total', 'info.help', 'cart.added', 'cart.removed', 'cart.added', 'cart.removed',
    'ask.listening', 'ask.noProduct', 'ask.failed', 'ask.failed',
  ]);
  expect(h.all.some((effect) => effect.type === 'speak.dropped')).toBe(false);
});
it('repeat always replays the last line that the shopper heard', () => {
  const h = harness({ cart: [RYE] });
  h.barcode(NOT_SOLD);
  h.advance(1000);
  // Dropped: the shopper did not hear it, so repeat does not speak it.
  h.kiosk({ busy: true });
  expect(dropped(h)).toEqual([['checkout.busy', 'gap']]);
  for (let count = 0; count < 3; count += 1) {
    h.intent('repeat');
    expect(h.lines()).toEqual(['barcode.notInStore']);
  }
});
it('a line of a time rule is unsolicited, also in the step of an action of the shopper', () => {
  const h = harness({ cart: [RYE] });
  // The unknown line waits for a still.
  h.result({ status: 'unknown' });
  expect(h.lines()).toEqual([]);
  h.advance(1500);
  h.kiosk({ busy: true });
  expect(h.lines()).toEqual(['checkout.busy']);
  // 2 seconds passed with no still, so the time rule speaks the unknown line in the step of this intent.
  h.now += 600;
  h.intent('help');
  expect(h.lines()).toEqual(['info.help']);
  expect(dropped(h)).toEqual([['glance.unknown', 'gap']]);
});
it('a solicited line with the same text counts for the 20 seconds, and not for the gap', () => {
  const h = harness();
  h.intent('total');
  expect(h.lines()).toEqual(['checkout.empty']);
  h.advance(100);
  h.barcode(NOT_SOLD);
  // The gap counts between two unsolicited lines.
  expect(h.lines()).toEqual(['barcode.notInStore']);
  h.advance(UNSOLICITED_GAP_MS);
  h.kiosk();
  expect(dropped(h)).toEqual([['checkout.empty', 'same text']]);
});
it('reports slow recognition one time each 60 seconds, with its event', () => {
  const h = harness();
  h.send({ type: 'recognition.slow' });
  expect(h.lines()).toEqual(['recognition.slow']);
  h.advance(59_000);
  h.send({ type: 'recognition.slow' });
  expect(h.effects).toEqual([]);
  h.advance(1000);
  h.send({ type: 'recognition.slow' });
  expect(h.lines()).toEqual(['recognition.slow']);
  expect(h.events()).toEqual(['error']);
});
it('guards a session that an older server stored, which has no voice state', () => {
  const h = harness();
  const { voice: _voice, ...stored } = h.state;
  h.state = stored as typeof h.state;
  h.barcode(NOT_SOLD);
  expect(h.lines()).toEqual(['barcode.notInStore']);
  h.advance(4000);
  h.barcode(ALSO_NOT_SOLD);
  expect(dropped(h)).toEqual([['barcode.notInStore', 'same text']]);
});
