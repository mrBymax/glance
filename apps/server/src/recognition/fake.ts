import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { type DeviceState, KioskCodeSchema, TIMING } from '@glance/shared';
import type { CatalogIndex } from '../catalog/catalog';
import type { Clock } from '../clock';
import { type LabelAnswer, LabelAnswerSchema } from '../label/reader';
import type { SessionRuntime } from '../sessions/runtime';
import { NO_RESULT, type RecognitionResult, RecognitionResultPartSchema } from './result';

/** A step covers the times from atMs up to, and not including, atMs + forMs. */
export type FakeStep =
  | { atMs: number; forMs: number; result: Partial<RecognitionResult> }
  /** 'newest' names the kiosk that registered last. Each other value is a kiosk code. */
  | { atMs: number; forMs: number; kiosk: string }
  /** The digits of a barcode that the phone reads, as `barcode.seen` carries them. */
  | { atMs: number; forMs: number; barcode: string };
/** `label` is the answer of the fake label reader for each label frame, or null for a reader that reads nothing. */
export type FakeScript = { loop: boolean; lengthMs: number; label: LabelAnswer | null; steps: FakeStep[] };

/** A script file that the server cannot use. The message names the file and the step. */
export class FakeScriptError extends Error {}

const FAKE_CONFIDENCE = 0.95;
const KIOSK_EVERY_MS = 1000;
/** The phone repeats a barcode report at this pace while the code is in view. */
const BARCODE_EVERY_MS = 1000;
/** The state of glasses that stream, for a session that has no phone. */
const FAKE_DEVICE: DeviceState = { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream: 'streaming' };

const at = { atMs: z.number().int().min(0), forMs: z.number().int().positive() };
const StepSchema = z.union([
  z.strictObject({ ...at, result: RecognitionResultPartSchema }),
  z.strictObject({ ...at, kiosk: z.union([z.literal('newest'), KioskCodeSchema]) }),
  z.strictObject({ ...at, barcode: z.string().regex(/^\d{8,14}$/) }),
]);
const ScriptSchema = z.strictObject({
  loop: z.boolean(), lengthMs: z.number().int().positive(), label: LabelAnswerSchema.optional(), steps: z.array(z.unknown()),
});

/**
 * Reads a script file. Throws FakeScriptError for a file that is no script,
 * and for a product ID that the catalog does not have. The message counts the steps from 1.
 */
export function readFakeScript(path: string, catalog: CatalogIndex): FakeScript {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new FakeScriptError(`Cannot read the script file ${path}: ${(error as Error).message}`, { cause: error });
  }
  const script = ScriptSchema.safeParse(json);
  if (!script.success) throw new FakeScriptError(`The script file ${path} is not a script. ${issueText(script.error)}`);

  const steps = script.data.steps.map((entry, index): FakeStep => {
    const where = `The script file ${path}, step ${index + 1}:`;
    const parsed = StepSchema.safeParse(entry);
    if (!parsed.success) {
      throw new FakeScriptError(`${where} a step has atMs, forMs, and one of result, kiosk, and barcode. ${issueText(parsed.error)}`);
    }
    const step = parsed.data;
    if ('result' in step) {
      const ids = [...(step.result.productId ? [step.result.productId] : []), ...(step.result.candidates ?? [])];
      const unknown = ids.find((id) => !catalog.get(id));
      if (unknown !== undefined) throw new FakeScriptError(`${where} the catalog has no product "${unknown}".`);
      return { atMs: step.atMs, forMs: step.forMs, result: definedFields(step.result) };
    }
    return step;
  });
  return { loop: script.data.loop, lengthMs: script.data.lengthMs, label: script.data.label ?? null, steps };
}

function issueText(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`).join(', ');
}

/** A field that the file does not hold must not replace the field of NO_RESULT with undefined. */
function definedFields(part: Record<string, unknown>): Partial<RecognitionResult> {
  return Object.fromEntries(Object.entries(part).filter(([, value]) => value !== undefined));
}

/** What the script shows at a time since its start. Outside each step the result is NO_RESULT. */
export function scriptAt(
  script: FakeScript, elapsedMs: number,
): { result: RecognitionResult; kiosk: string | null; barcode: string | null } {
  const nothing = { result: NO_RESULT, kiosk: null, barcode: null };
  if (!script.loop && elapsedMs >= script.lengthMs) return nothing;
  const time = script.loop ? elapsedMs % script.lengthMs : elapsedMs;
  const step = script.steps.find((entry) => time >= entry.atMs && time < entry.atMs + entry.forMs);
  if (!step) return nothing;
  if ('kiosk' in step) return { ...nothing, kiosk: step.kiosk };
  if ('barcode' in step) return { ...nothing, barcode: step.barcode };
  return { ...nothing, result: { ...NO_RESULT, confidence: FAKE_CONFIDENCE, ...step.result } };
}

type Playing = { timer: NodeJS.Timeout; removeStopListener: () => void };

/** Plays one script into each session that starts it, in place of the phone frames and the recognition calls. */
export class ScriptPlayer {
  private readonly playing = new Map<string, Playing>();

  constructor(private readonly deps: {
    script: FakeScript; clock: Clock; onKiosk: (session: SessionRuntime, which: string) => void;
    /** Gets the code of a barcode step, as the phone reports it. */
    onBarcode: (session: SessionRuntime, code: string) => void;
    /** Gets the digits of the code of a result, as the model read them. */
    onCode: (session: SessionRuntime, digits: string) => void;
  }) {}

  /**
   * Starts the script for a session at the time 0. A second start for the same session does nothing.
   * With `fakeDevice` the session first gets the state of glasses that stream, so a session with no phone has a camera.
   */
  start(session: SessionRuntime, opts: { fakeDevice: boolean }): void {
    if (this.playing.has(session.id) || session.stopped) return;
    const { script, clock, onKiosk, onBarcode, onCode } = this.deps;
    const startedAt = clock.now();
    let kioskAt: number | null = null;
    let barcodeAt: number | null = null;

    const timer = setInterval(() => {
      const now = clock.now();
      const { result, kiosk, barcode } = scriptAt(script, now - startedAt);
      session.dispatch({ type: 'recognition', result, still: false });
      if (result.code.digits !== null) onCode(session, result.code.digits);
      if (kiosk !== null && (kioskAt === null || now - kioskAt >= KIOSK_EVERY_MS)) {
        kioskAt = now;
        onKiosk(session, kiosk);
      }
      if (barcode !== null && (barcodeAt === null || now - barcodeAt >= BARCODE_EVERY_MS)) {
        barcodeAt = now;
        onBarcode(session, barcode);
      }
    }, TIMING.uploadEveryMs);
    this.playing.set(session.id, { timer, removeStopListener: session.onStop(() => this.stop(session.id)) });

    if (opts.fakeDevice) session.dispatch({ type: 'device.state', state: FAKE_DEVICE });
  }

  stop(sessionId: string): void {
    const entry = this.playing.get(sessionId);
    if (!entry) return;
    this.playing.delete(sessionId);
    clearInterval(entry.timer);
    entry.removeStopListener();
  }

  /** For the close of the app. */
  stopAll(): void {
    for (const sessionId of [...this.playing.keys()]) this.stop(sessionId);
  }
}
