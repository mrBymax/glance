import { expect, it } from 'vitest';
import { EventBus, kioskTopic, sessionTopic } from './bus';

it('delivers a message to the listeners of its topic only', () => {
  const bus = new EventBus(); const a: unknown[] = []; const b: unknown[] = [];
  bus.subscribe(sessionTopic('s1'), (m) => a.push(m));
  bus.subscribe(sessionTopic('s2'), (m) => b.push(m));
  bus.publish(sessionTopic('s1'), { type: 'glance.unknown' });
  expect(a).toEqual([{ type: 'glance.unknown' }]);
  expect(b).toEqual([]);
});
it('stops after unsubscribe', () => {
  const bus = new EventBus(); const got: unknown[] = [];
  const off = bus.subscribe('t', (m) => got.push(m));
  bus.publish('t', 1); off(); bus.publish('t', 2);
  expect(got).toEqual([1]);
});
it('keeps delivering when one listener throws', () => {
  const bus = new EventBus(); const got: unknown[] = [];
  bus.subscribe('t', () => { throw new Error('x'); });
  bus.subscribe('t', (m) => got.push(m));
  bus.publish('t', 1);
  expect(got).toEqual([1]);
});
it('keeps the session topics and the kiosk topics apart', () => {
  expect(sessionTopic('a1')).toBe('session:a1');
  expect(kioskTopic('a1')).toBe('kiosk:a1');
});
