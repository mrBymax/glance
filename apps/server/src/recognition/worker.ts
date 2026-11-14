import { type FrameHeader, TIMING } from '@glance/shared';
import type { Recognizer } from './gemini';
import type { RecognitionResult } from './result';

export type Frame = { header: FrameHeader; jpeg: Uint8Array };

const SLOW_AFTER_FAILED_CALLS = 3;
const LOGGED_MESSAGE_CHARS = 200;

type Call = { frame: Frame; abort: AbortController; timer: NodeJS.Timeout };

const isStill = (frame: Frame): boolean => frame.header.kind === 'still';

/**
 * The recognition calls of one session: one call at a time, and the newest frame next (spec section 11.1).
 * The worker holds a frame only while its call runs or while it waits for the call before it.
 */
export class RecognitionWorker {
  private call: Call | null = null;
  private waiting: Frame | null = null;
  private failedInRow = 0;
  private stopped = false;

  constructor(private readonly deps: {
    recognizer: Recognizer;
    /** Read at the start of each call. */
    exclude: () => string[];
    onResult: (result: RecognitionResult, info: { seq: number; still: boolean; ms: number }) => void;
    /** Runs one time when 3 calls in a row failed. A good call starts the count again. */
    onSlow: () => void;
    /** Gets one line for each failed call. */
    log?: (line: string) => void;
  }) {}

  submit(frame: Frame): void {
    if (this.stopped) return;
    if (!this.call) {
      this.start(frame);
      return;
    }
    // A still is the sharp second look that the phone took on request. A stream frame must not push it out.
    if (this.waiting && isStill(this.waiting) && !isStill(frame)) return;
    this.waiting = frame;
  }

  /** The bytes of the frame in the call plus the waiting frame. */
  heldBytes(): number {
    return (this.call?.frame.jpeg.length ?? 0) + (this.waiting?.jpeg.length ?? 0);
  }

  /** Aborts the call and drops the waiting frame. No callback runs after it. */
  stop(): void {
    this.stopped = true;
    this.waiting = null;
    const call = this.call;
    if (!call) return;
    this.call = null;
    clearTimeout(call.timer);
    call.abort.abort();
  }

  private start(frame: Frame): void {
    const abort = new AbortController();
    const startedAt = performance.now();
    const { seq } = frame.header;
    const still = isStill(frame);

    const timer = setTimeout(() => {
      if (!this.finish(call)) return;
      abort.abort();
      this.failed(`recognition call dropped after ${TIMING.recognitionTimeoutMs} ms. seq=${seq}`);
      this.next();
    }, TIMING.recognitionTimeoutMs);
    const call: Call = { frame, abort, timer };
    this.call = call;

    const onError = (error: unknown): void => {
      if (!this.finish(call)) return;
      const { name, message } = error instanceof Error ? error : { name: 'Error', message: String(error) };
      this.failed(`recognition call failed. seq=${seq} ${name}: ${message.slice(0, LOGGED_MESSAGE_CHARS)}`);
      this.next();
    };
    const onAnswer = (result: RecognitionResult): void => {
      if (!this.finish(call)) return;
      this.failedInRow = 0;
      try {
        this.deps.onResult(result, { seq, still, ms: Math.round(performance.now() - startedAt) });
      } catch (error) {
        // A failure of the rules is no failure of the recognition service, so it does not count toward "slow".
        this.deps.log?.(`recognition result of seq=${seq} failed in the session. ${(error as Error).message}`);
      }
      this.next();
    };

    let answer: Promise<RecognitionResult>;
    try {
      answer = this.deps.recognizer.recognize(frame.jpeg, { exclude: this.deps.exclude(), still, signal: abort.signal });
    } catch (error) {
      // The next frame must start after this stack, so a recognizer that always throws cannot loop here.
      queueMicrotask(() => onError(error));
      return;
    }
    answer.then(onAnswer, onError);
  }

  /** Ends the call and drops its frame. Returns false for a call that was dropped or stopped before. */
  private finish(call: Call): boolean {
    if (this.call !== call) return false;
    this.call = null;
    clearTimeout(call.timer);
    return true;
  }

  private failed(line: string): void {
    this.deps.log?.(line);
    this.failedInRow += 1;
    if (this.failedInRow === SLOW_AFTER_FAILED_CALLS) this.deps.onSlow();
  }

  private next(): void {
    // A callback can stop the worker or submit a frame, so the state is read again here.
    if (this.stopped || this.call || !this.waiting) return;
    const frame = this.waiting;
    this.waiting = null;
    this.start(frame);
  }
}
