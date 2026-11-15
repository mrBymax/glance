import { expect, it } from 'vitest';
import { NOT_HELD, type Observation } from './observation';
import { AppearanceTracker } from './tracker';

const seen = (part: Partial<Observation> = {}): Observation => ({ ...NOT_HELD, held: true, kind: 'can', legible: 'some', ...part });
const jpeg = (name: string): Uint8Array => new TextEncoder().encode(name);
const tracker = (): AppearanceTracker => new AppearanceTracker({ viewMs: 3000, keep: 3 });
const nameOf = (frame: { jpeg: Uint8Array }): string => new TextDecoder().decode(frame.jpeg);

it('gives no appearance for a frame with no product in a hand', () => {
  const t = tracker();
  expect(t.add(NOT_HELD, 0, jpeg('a'))).toBeNull();
  expect(t.current(0)).toBeNull();
});
it('groups the frames of one held product into one appearance', () => {
  const t = tracker();
  const first = t.add(seen(), 0, jpeg('a'))!;
  const second = t.add(seen(), 400, jpeg('b'))!;
  expect(second.id).toBe(first.id);
  expect(second.frames).toBe(2);
  expect(second.startedAt).toBe(0);
});
it('keeps the appearance over frames with no product for less than the view time', () => {
  const t = tracker();
  const first = t.add(seen(), 0, jpeg('a'))!;
  t.add(NOT_HELD, 1000, jpeg('b'));
  expect(t.add(seen(), 2900, jpeg('c'))!.id).toBe(first.id);
});
it('starts a new appearance after the view time with no held product', () => {
  const t = tracker();
  const first = t.add(seen(), 0, jpeg('a'))!;
  t.add(NOT_HELD, 1000, jpeg('b'));
  expect(t.current(3001)).toBeNull();
  const next = t.add(seen(), 3100, jpeg('c'))!;
  expect(next.id).not.toBe(first.id);
  expect(next.frames).toBe(1);
});
it('a field counts when 2 frames agree, with no case and no accent', () => {
  const t = tracker();
  expect(t.add(seen({ brand: 'KILI', variant: 'Vadelma' }), 0, jpeg('a'))!.merged).toMatchObject({ brand: null, variant: null });
  const merged = t.add(seen({ brand: 'kili', variant: 'Mango' }), 400, jpeg('b'))!.merged;
  expect(merged.brand).toBe('KILI');
  expect(merged.variant).toBeNull();
});
it('a field of one clear frame counts at once', () => {
  const t = tracker();
  const { merged } = t.add(seen({ legible: 'clear', brand: 'Kili', name: 'Cascara', variant: 'Vadelma', size: '330 ml' }), 0, jpeg('a'))!;
  expect(merged).toMatchObject({ brand: 'Kili', name: 'Cascara', variant: 'Vadelma', size: '330 ml' });
});
it('takes the value with the most votes, and a clear frame counts two times', () => {
  const t = tracker();
  t.add(seen({ variant: 'Vadelma' }), 0, jpeg('a'));
  t.add(seen({ variant: 'Mango' }), 400, jpeg('b'));
  t.add(seen({ variant: 'Mango' }), 800, jpeg('c'));
  expect(t.add(seen({ variant: 'vadelma' }), 1200, jpeg('d'))!.merged.variant).toBeNull();
  expect(t.add(seen({ variant: 'Vadelma', legible: 'clear' }), 1600, jpeg('e'))!.merged.variant).toBe('Vadelma');
});
it('two values with equal votes give no value', () => {
  const t = tracker();
  t.add(seen({ variant: 'Vadelma' }), 0, jpeg('a'));
  t.add(seen({ variant: 'Vadelma' }), 400, jpeg('b'));
  t.add(seen({ variant: 'Mango' }), 800, jpeg('c'));
  expect(t.add(seen({ variant: 'Mango' }), 1200, jpeg('d'))!.merged.variant).toBeNull();
});
it('merges the other words by word, and the colors and the kind by votes', () => {
  const t = tracker();
  t.add(seen({ texts: ['Energy drink', 'Zero'], colors: ['white', 'red'], kind: 'can' }), 0, jpeg('a'));
  const { merged } = t.add(seen({ texts: ['ZERO sugar'], colors: ['white', 'pink'], kind: 'bottle' }), 400, jpeg('b'))!;
  expect(merged.texts).toEqual(['zero']);
  expect(merged.colors).toEqual(['white']);
  expect(merged.kind).toBe('can');
});
it('keeps each digit run that it saw, one time', () => {
  const t = tracker();
  t.add(seen({ digits: ['6430062761764'] }), 0, jpeg('a'));
  expect(t.add(seen({ digits: ['6430062761764', '12345678'] }), 400, jpeg('b'))!.merged.digits).toEqual(['6430062761764', '12345678']);
});
it('counts the frames with readable print', () => {
  const t = tracker();
  t.add(seen({ legible: 'none' }), 0, jpeg('a'));
  t.add(seen({ legible: 'some' }), 400, jpeg('b'));
  expect(t.add(seen({ legible: 'clear' }), 800, jpeg('c'))!.legibleFrames).toBe(2);
});
it('keeps the frames with the most readable print, and then the largest product', () => {
  const t = tracker();
  t.add(seen({ legible: 'none', box: [0, 0, 900, 900] }), 0, jpeg('none-large'));
  t.add(seen({ legible: 'some', box: [0, 0, 200, 200] }), 400, jpeg('some-small'));
  t.add(seen({ legible: 'clear', box: [0, 0, 100, 100] }), 800, jpeg('clear'));
  const { kept } = t.add(seen({ legible: 'some', box: [0, 0, 500, 500] }), 1200, jpeg('some-large'))!;
  expect(kept.map(nameOf)).toEqual(['some-small', 'clear', 'some-large']);
});
it('gives the kept frames oldest first, and holds no other frame', () => {
  const t = tracker();
  for (let i = 0; i < 6; i += 1) t.add(seen(), i * 400, jpeg(`f${i}`));
  expect(t.current(2400)!.kept.map(nameOf)).toEqual(['f3', 'f4', 'f5']);
});
it('a new brand in 2 frames in a row is a new appearance', () => {
  const t = tracker();
  t.add(seen({ brand: 'Kili' }), 0, jpeg('a'));
  const first = t.add(seen({ brand: 'Kili' }), 400, jpeg('b'))!;
  expect(t.add(seen({ brand: 'Hell' }), 800, jpeg('c'))!.id).toBe(first.id);
  const changed = t.add(seen({ brand: 'Hell' }), 1200, jpeg('d'))!;
  expect(changed.id).not.toBe(first.id);
  expect(changed.frames).toBe(2);
  expect(changed.merged.brand).toBe('Hell');
  expect(changed.kept.map(nameOf)).toEqual(['c', 'd']);
});
it('one frame with another brand does not end the appearance', () => {
  const t = tracker();
  t.add(seen({ brand: 'Kili' }), 0, jpeg('a'));
  const first = t.add(seen({ brand: 'Kili' }), 400, jpeg('b'))!;
  t.add(seen({ brand: 'Hell' }), 800, jpeg('c'));
  const back = t.add(seen({ brand: 'Kili' }), 1200, jpeg('d'))!;
  expect(back.id).toBe(first.id);
  expect(back.merged.brand).toBe('Kili');
});
it('a brand that is cut off is the same brand', () => {
  const t = tracker();
  t.add(seen({ brand: 'Barilla' }), 0, jpeg('a'));
  const first = t.add(seen({ brand: 'Barilla' }), 400, jpeg('b'))!;
  t.add(seen({ brand: 'Baril' }), 800, jpeg('c'));
  expect(t.add(seen({ brand: 'Baril' }), 1200, jpeg('d'))!.id).toBe(first.id);
});
it('a new kind in 2 frames in a row is a new appearance', () => {
  const t = tracker();
  t.add(seen({ kind: 'can' }), 0, jpeg('a'));
  const first = t.add(seen({ kind: 'can' }), 400, jpeg('b'))!;
  t.add(seen({ kind: 'box' }), 800, jpeg('c'));
  expect(t.add(seen({ kind: 'box' }), 1200, jpeg('d'))!.id).not.toBe(first.id);
});
it('takes an observation that arrives late into its appearance', () => {
  const t = tracker();
  t.add(seen({ variant: 'Vadelma' }), 800, jpeg('b'));
  const merged = t.add(seen({ variant: 'Vadelma' }), 400, jpeg('a'))!;
  expect(merged.frames).toBe(2);
  expect(merged.startedAt).toBe(400);
  expect(merged.merged.variant).toBe('Vadelma');
});
it('drops an observation that is older than the view time of the appearance', () => {
  const t = tracker();
  const first = t.add(seen(), 5000, jpeg('b'))!;
  expect(t.add(seen(), 1000, jpeg('a'))).toBeNull();
  expect(t.current(5000)!.id).toBe(first.id);
  expect(t.current(5000)!.frames).toBe(1);
});
it('holds the outcome of an appearance until the appearance ends', () => {
  const t = tracker();
  const first = t.add(seen(), 0, jpeg('a'))!;
  first.outcome = 'decided';
  expect(t.add(seen(), 400, jpeg('b'))!.outcome).toBe('decided');
  t.add(NOT_HELD, 500, jpeg('c'));
  expect(t.add(seen(), 4000, jpeg('d'))!.outcome).toBeUndefined();
});
