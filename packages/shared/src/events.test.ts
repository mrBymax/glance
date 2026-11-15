import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseServerEvent } from './events';

const dir = new URL('../fixtures/events/', import.meta.url);

describe('server events', () => {
  it('parses each event fixture, and the file name is the type', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(16);
    for (const file of files) {
      const event = parseServerEvent(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
      expect(event?.type).toBe(file.replace(/\.json$/, ''));
    }
  });
  it('returns null for an unknown type and for input that is not an object', () => {
    expect(parseServerEvent({ type: 'glance.exploded' })).toBeNull();
    expect(parseServerEvent('x')).toBeNull();
    expect(parseServerEvent(null)).toBeNull();
  });
  it('requires a prompt ID on a pending glance', () => {
    const { promptId, ...rest } = JSON.parse(readFileSync(new URL('glance.pending.json', dir), 'utf8'));
    expect(parseServerEvent(rest)).toBeNull();
  });
});
