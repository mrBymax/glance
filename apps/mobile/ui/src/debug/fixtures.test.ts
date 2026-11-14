import { expect, it } from 'vitest';
import { EVENT_TYPES, eventFixture, eventMessage, SNAPSHOT } from './fixtures';

it('holds one fixture for each of the 16 event types', () => {
  expect(EVENT_TYPES).toHaveLength(16);
  for (const type of EVENT_TYPES) expect(eventFixture(type).type).toBe(type);
});
it('makes an event message with a change', () => {
  expect(eventMessage('glance.cleared', { promptId: 'p-0009' })).toEqual({
    t: 'event',
    event: { type: 'glance.cleared', promptId: 'p-0009' },
  });
});
it('holds the session of the snapshot fixture', () => {
  expect(SNAPSHOT.sessionId).toBe('s-1');
  expect(SNAPSHOT.prompt?.promptId).toBe('p-0001');
});
