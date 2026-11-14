import { expect, it } from 'vitest';
import * as shared from './index';

it('exports the names that the other plans use', () => {
  for (const name of ['TIMING', 'LANGS', 'EU_ALLERGENS', 'DEFAULT_PROFILE', 'EMPTY_CART', 'formatEur',
    'cartTotalCents', 'formatKioskCode', 'parseKioskCode', 'localize', 'toProductRef', 'encodeFrame',
    'decodeFrame', 'FrameFormatError', 'parseServerEvent', 'parseDeviceToServer', 'parseServerToDevice',
    'parsePageToNative', 'parseNativeToPage', 'ProfileSchema', 'ProfilePatchSchema', 'ProductSchema',
    'CartSchema', 'ServerEventSchema', 'SessionSnapshotSchema', 'KioskEventSchema']) {
    expect(shared).toHaveProperty(name);
  }
});
