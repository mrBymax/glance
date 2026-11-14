import { z } from 'zod';
import { CartEditSchema } from './cart';
import { IntentKindSchema, StreamStateSchema } from './device';
import { ServerEventSchema } from './events';
import { ProfilePatchSchema, ProfileSchema } from './profile';
import { SessionSnapshotSchema } from './snapshot';

// Wire format in the WebView:
//   Page to Kotlin: window.GlanceNative.postMessage(json), with a PageToNative as a JSON string.
//   Kotlin to page: window.__glanceReceive(json), with a NativeToPage as a JSON string.
// The page sends ui.ready after it sets window.__glanceReceive. Kotlin answers with native.state and profile.
// The phone reports its own failures to the page as error events with a code that starts with "native.".

export const HapticPatternSchema = z.enum([
  'prompt', 'added', 'removed', 'warning', 'paid', 'error', 'cameraPaused', 'cameraOff',
]);
export type HapticPattern = z.infer<typeof HapticPatternSchema>;

export const NativeStateSchema = z.object({
  metaAiInstalled: z.boolean(),
  registration: z.enum(['unavailable', 'available', 'registering', 'registered']),
  cameraPermission: z.enum(['unknown', 'granted', 'denied']),
  device: z.object({
    name: z.string().nullable(),
    link: z.enum(['connected', 'disconnected']),
    battery: z.number().min(0).max(100).nullable(),
    worn: z.boolean().nullable(),
    hingeOpen: z.boolean().nullable(),
    // 0 to 7, in the order of the DAT thermal levels. Level 6 and above means that the glasses cannot stream.
    thermal: z.number().int().min(0).max(7).nullable(),
    updateRequired: z.boolean(),
  }).nullable(),
  session: z.enum(['idle', 'starting', 'started', 'paused', 'stopped']),
  stream: StreamStateSchema,
  // 'online' while the device socket to the server is open.
  network: z.enum(['online', 'offline']),
  capabilities: z.object({ motion: z.boolean(), inputs: z.boolean(), speech: z.boolean() }),
  mock: z.boolean(),
});
export type NativeState = z.infer<typeof NativeStateSchema>;

export const PageToNativeSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ui.ready') }),
  z.object({ t: z.literal('setup.register') }),
  z.object({ t: z.literal('setup.requestCamera') }),
  z.object({ t: z.literal('setup.openUpdate') }),
  z.object({ t: z.literal('session.start') }),
  z.object({ t: z.literal('session.end') }),
  z.object({ t: z.literal('intent'), kind: IntentKindSchema, promptId: z.string().min(1).optional() }),
  CartEditSchema.extend({ t: z.literal('cart.edit') }),
  z.object({ t: z.literal('profile.set'), patch: ProfilePatchSchema }),
  z.object({ t: z.literal('pocket.set'), on: z.boolean() }),
  z.object({ t: z.literal('haptic'), pattern: HapticPatternSchema }),
  z.object({ t: z.literal('data.delete') }),
]);
export type PageToNative = z.infer<typeof PageToNativeSchema>;

export const NativeToPageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('native.state'), state: NativeStateSchema }),
  z.object({ t: z.literal('profile'), profile: ProfileSchema }),
  z.object({ t: z.literal('event'), event: ServerEventSchema }),
  z.object({ t: z.literal('snapshot'), session: SessionSnapshotSchema }),
]);
export type NativeToPage = z.infer<typeof NativeToPageSchema>;

/** The link between the phone UI and its host. The phone UI has no network code of its own. */
export interface GlanceBridge {
  send(message: PageToNative): void;
  /** Returns the function that removes the listener. */
  subscribe(listener: (message: NativeToPage) => void): () => void;
}

/** Returns the message, or null for input that is no message of this version. It never throws. */
export function parsePageToNative(input: unknown): PageToNative | null {
  const result = PageToNativeSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Returns the message, or null for input that is no message of this version. It never throws. */
export function parseNativeToPage(input: unknown): NativeToPage | null {
  const result = NativeToPageSchema.safeParse(input);
  return result.success ? result.data : null;
}
