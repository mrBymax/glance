import { expect, it, vi } from 'vitest';
import { fakeSources } from '../test/fakes';
import { replay, subscribeSse } from './events';

const objectOnly = (input: unknown) => (typeof input === 'object' ? input : null);

it('parses each stream message, drops bad ones, and reports the link', () => {
  const sources = fakeSources();
  const events: unknown[] = [];
  const status: string[] = [];
  const close = subscribeSse('/x', (input) => (typeof input === 'object' ? input : null),
    { onEvent: (event) => events.push(event), onStatus: (s) => status.push(s) }, sources.create);
  const source = sources.sources[0]!;
  source.emit('open');
  source.emit('message', '{"a":1}');
  source.emit('message', 'not json');
  source.emit('message', '"text"');
  source.emit('error');
  expect(events).toEqual([{ a: 1 }]);
  expect(status).toEqual(['open', 'lost']);
  close();
  expect(source.closed).toBe(true);
});
it('reports a stream that the browser does not open again', () => {
  const sources = fakeSources();
  const status: string[] = [];
  subscribeSse('/x', objectOnly, { onEvent: () => {}, onStatus: (s) => status.push(s) }, sources.create);
  const source = sources.sources[0]!;
  source.readyState = 2;
  source.emit('error');
  expect(status).toEqual(['closed']);
});
it('delivers nothing after the close', () => {
  const sources = fakeSources();
  const seen: unknown[] = [];
  const close = subscribeSse('/x', objectOnly, { onEvent: (event) => seen.push(event), onStatus: (s) => seen.push(s) }, sources.create);
  close();
  sources.sources[0]?.emit('open');
  sources.sources[0]?.emit('message', '{"a":1}');
  sources.sources[0]?.emit('error');
  expect(seen).toEqual([]);
});
it('plays a recording one time, and stops on request', () => {
  vi.useFakeTimers();
  const seen: string[] = [];
  const stop = replay([{ afterMs: 0, event: 'a' }, { afterMs: 1000, event: 'b' }, { afterMs: 2000, event: 'c' }], (event) => seen.push(event));
  vi.advanceTimersByTime(1000);
  expect(seen).toEqual(['a', 'b']);
  stop();
  vi.advanceTimersByTime(5000);
  expect(seen).toEqual(['a', 'b']);
  vi.useRealTimers();
});
it('plays a recording in a loop that starts again at the time of the last event', () => {
  vi.useFakeTimers();
  const seen: string[] = [];
  const stop = replay([{ afterMs: 0, event: 'a' }, { afterMs: 1000, event: 'b' }], (event) => seen.push(event), true);
  vi.advanceTimersByTime(2500);
  expect(seen).toEqual(['a', 'b', 'a', 'b', 'a']);
  stop();
  vi.advanceTimersByTime(5000);
  expect(seen).toHaveLength(5);
  vi.useRealTimers();
});
