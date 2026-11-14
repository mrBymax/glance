import { z } from 'zod';
import { CartEditSchema } from './cart';
import { PrioritySchema, ServerEventSchema, SoundNameSchema } from './events';
import { LangSchema } from './languages';
import { ProfilePatchSchema } from './profile';
import { SessionSnapshotSchema } from './snapshot';

// 'ask' opens the question window of extra 5. It needs no prompt ID.
export const IntentKindSchema = z.enum(['yes', 'no', 'undo', 'repeat', 'total', 'cart', 'help', 'stop', 'ask']);
export type IntentKind = z.infer<typeof IntentKindSchema>;

export const IntentSourceSchema = z.enum(['head', 'voice', 'touch', 'phone', 'key', 'camera', 'hud']);
export type IntentSource = z.infer<typeof IntentSourceSchema>;

export const StreamStateSchema = z.enum(['stopped', 'starting', 'streaming', 'paused']);
export type StreamState = z.infer<typeof StreamStateSchema>;

export const DeviceStateSchema = z.object({
  link: z.enum(['connected', 'disconnected']),
  battery: z.number().min(0).max(100).nullable(),
  worn: z.boolean().nullable(),
  hingeOpen: z.boolean().nullable(),
  // 0 to 7, in the order of the DAT thermal levels.
  thermal: z.number().int().min(0).max(7).nullable(),
  stream: StreamStateSchema,
});
export type DeviceState = z.infer<typeof DeviceStateSchema>;

// 'barcode' is a code from the barcode decoder. 'ocr' is a code from the digits under the bars.
export const BarcodeSourceSchema = z.enum(['barcode', 'ocr']);
export type BarcodeSource = z.infer<typeof BarcodeSourceSchema>;

const promptId = z.string().min(1);

export const DeviceToServerSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('intent'), kind: IntentKindSchema, source: IntentSourceSchema, promptId: promptId.optional() }),
  z.object({ t: z.literal('prompt.done'), promptId }),
  z.object({ t: z.literal('kiosk.seen'), text: z.string() }),
  // The code as the phone read it. The server checks it and makes 13 digits of it (gtin.ts).
  z.object({ t: z.literal('barcode.seen'), code: z.string().regex(/^\d{8,14}$/), source: BarcodeSourceSchema }),
  z.object({
    t: z.literal('speech.final'),
    text: z.string(),
    // The phone sends 0.5 when the glasses give no value.
    confidence: z.number().min(0).max(1),
    locale: z.string(),
  }),
  z.object({ t: z.literal('device.state'), state: DeviceStateSchema }),
  CartEditSchema.extend({ t: z.literal('cart.edit') }),
  z.object({ t: z.literal('profile.set'), patch: ProfilePatchSchema }),
  z.object({ t: z.literal('biometric.result'), ok: z.boolean() }),
]);
export type DeviceToServer = z.infer<typeof DeviceToServerSchema>;

export const ServerToDeviceSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('speak'),
    id: z.string().min(1),
    priority: PrioritySchema,
    text: z.string(),
    lang: LangSchema,
    // null when no clip exists. The phone then reads the text with its own voice.
    url: z.string().nullable(),
    sound: SoundNameSchema.nullable(),
    interrupt: z.boolean(),
    // A line with a prompt ID is a prompt. The phone sends prompt.done with that ID when the clip ends.
    promptId: promptId.nullable(),
  }),
  z.object({ t: z.literal('event'), event: ServerEventSchema }),
  z.object({ t: z.literal('snapshot'), session: SessionSnapshotSchema }),
  z.object({ t: z.literal('session.rest') }),
  z.object({ t: z.literal('session.end') }),
  z.object({ t: z.literal('biometric.request') }),
  // The server asks for one still when it sees a barcode that it cannot read. The phone answers with barcode.seen
  // or with a frame of the kind 'label', and its limit for stills can drop the request.
  z.object({ t: z.literal('still.request'), purpose: z.literal('label') }),
]);
export type ServerToDevice = z.infer<typeof ServerToDeviceSchema>;

/** Returns the message, or null for input that is no message of this version. It never throws. */
export function parseDeviceToServer(input: unknown): DeviceToServer | null {
  const result = DeviceToServerSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Returns the message, or null for input that is no message of this version. It never throws. */
export function parseServerToDevice(input: unknown): ServerToDevice | null {
  const result = ServerToDeviceSchema.safeParse(input);
  return result.success ? result.data : null;
}
