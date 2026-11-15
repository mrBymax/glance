import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import * as shared from './index';
import {
  DeviceToServerSchema, FrameHeaderSchema, NativeToPageSchema, PageToNativeSchema, ProductSchema, ServerEventSchema, ServerToDeviceSchema,
} from './index';

const root = new URL('../fixtures/', import.meta.url);

const SCHEMA_BY_FOLDER = {
  catalog: ProductSchema,
  events: ServerEventSchema,
  'device-to-server': DeviceToServerSchema,
  'server-to-device': ServerToDeviceSchema,
  'bridge-page-to-native': PageToNativeSchema,
  'bridge-native-to-page': NativeToPageSchema,
  'frame-headers': FrameHeaderSchema,
} as const;

function readFolder(folder: string): { file: string; json: unknown }[] {
  const dir = new URL(`${folder}/`, root);
  return readdirSync(dir).map((file) => ({ file, json: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) }));
}

describe('fixtures', () => {
  it('has a schema for each fixture folder except rest', () => {
    const folders = readdirSync(root).filter((f) => f !== 'rest');
    expect(folders.sort()).toEqual(Object.keys(SCHEMA_BY_FOLDER).sort());
  });
  it('validates each fixture against the schema of its folder', () => {
    for (const [folder, schema] of Object.entries(SCHEMA_BY_FOLDER)) {
      const fixtures = readFolder(folder);
      expect(fixtures.length, folder).toBeGreaterThan(0);
      for (const { file, json } of fixtures) {
        expect(schema.safeParse(json).success, `${folder}/${file}`).toBe(true);
      }
    }
  });
  it('has one bridge fixture for each message variant, and the file name is the t value', () => {
    for (const [folder, count] of [['bridge-page-to-native', 11], ['bridge-native-to-page', 4]] as const) {
      const fixtures = readFolder(folder);
      expect(fixtures.length, folder).toBe(count);
      for (const { file, json } of fixtures) {
        expect((json as { t: string }).t, `${folder}/${file}`).toBe(file.replace(/\.json$/, ''));
      }
    }
  });
  it('validates each rest fixture against the schema with the name of the file', () => {
    const fixtures = readFolder('rest');
    expect(fixtures.length).toBe(8);
    const schemas = shared as unknown as Record<string, ZodType | undefined>;
    for (const { file, json } of fixtures) {
      const schema = schemas[`${file.replace(/\.json$/, '')}Schema`];
      expect(schema, file).toBeDefined();
      expect(schema?.safeParse(json).success, file).toBe(true);
    }
  });
});
