import { type FrameHeader, TIMING } from '@glance/shared';
import type { Recognizer } from './gemini';
import type { RecognitionResult } from './result';

/** `context` is the context image of a crop: the whole frame in a small size. */
export type Frame = { header: FrameHeader; jpeg: Uint8Array; context?: Uint8Array };

const bytesOf = (frame: Frame): number => frame.jpeg.length + (frame.context?.length ?? 0);

const SLOW_AFTER_FAILED_CALLS = 3;
const LOGGED_MESSAGE_CHARS = 200;

/** `order` counts the frames of the session as they arrive. */
type Waiting = { frame: Frame; order: number; since: number };
type Call = { frame: Frame; order: number; abort: AbortController; timer: NodeJS.Timeout };

const isStill = (frame: Frame): boolean => frame.header.kind === 'still';

/**
 * The recognition calls of one session: up to `concurrency` calls at a time, and the newest frame next (spec section 11.1).
 * The answers can arrive in another order than the frames. The rules must never go back in time, so the worker drops
 * the result of a stream frame when a newer frame has its result.
 * The worker holds a frame only while its call runs or while it waits for a free call.
 */
export class RecognitionWorker {
  private readonly calls = new Set<Call>();
  private waiting: Waiting | null = null;
  private frames = 0;
  /** The `order` of the newest frame whose result reached `onResult`. */
  private applied = 0;
  private failedInRow = 0;
  private stopped = false;

  constructor(private readonly deps: {
    recognizer: Recognizer;
    /** The number of calls that can run at the same time. */
    concurrency: number;
    /** Read at the start of each call. */
    exclude: () => string[];
    /** `ms` is the time of the call, and `waitMs` is the time that the frame waited for a free call. */
    onResult: (result: RecognitionResult, info: { seq: number; still: boolean; ms: number; waitMs: number }) => void;
    /** Runs one time when 3 calls in a row failed. A good call starts the count again. */
    onSlow: () => void;
    /** Gets one line for each failed call. */
    log?: (line: string) => void;
    /** Gets one line for each result that the worker dropped because a newer frame has its result. */
    debug?: (line: string) => void;
  }) {}

  submit(frame: Frame): void {
    if (this.stopped) return;
    this.frames += 1;
    const entry: Waiting = { frame, order: this.frames, since: performance.now() };
    if (this.calls.size < this.deps.concurrency) {
      this.start(entry);
      return;
    }
    // A still is the sharp second look that the phone took on request. A stream frame must not push it out.
    if (this.waiting && isStill(this.waiting.frame) && !isStill(frame)) return;
    this.waiting = entry;
  }

  /** The bytes of the frames in the calls plus the waiting frame, each with its context image. */
  heldBytes(): number {
    let bytes = this.waiting ? bytesOf(this.waiting.frame) : 0;
    for (const call of this.calls) bytes += bytesOf(call.frame);
    return bytes;
  }

  /** Aborts each call and drops the waiting frame. No callback runs after it. */
  stop(): void {
    this.stopped = true;
    this.waiting = null;
    const calls = [...this.calls];
    this.calls.clear();
    for (const call of calls) {
      clearTimeout(call.timer);
      call.abort.abort();
    }
  }

  private start({ frame, order, since }: Waiting): void {
    const abort = new AbortController();
    const startedAt = performance.now();
    const waitMs = Math.round(startedAt - since);
    const { seq } = frame.header;
    const still = isStill(frame);

    const timer = setTimeout(() => {
      if (!this.finish(call)) return;
      abort.abort();
      this.failed(`recognition call dropped after ${TIMING.recognitionTimeoutMs} ms. seq=${seq}`);
      this.next();
    }, TIMING.recognitionTimeoutMs);
    const call: Call = { frame, order, abort, timer };
    this.calls.add(call);

    const onError = (error: unknown): void => {
      if (!this.finish(call)) return;
      const { name, message } = error instanceof Error ? error : { name: 'Error', message: String(error) };
      this.failed(`recognition call failed. seq=${seq} ${name}: ${message.slice(0, LOGGED_MESSAGE_CHARS)}`);
      this.next();
    };
    const onAnswer = (result: RecognitionResult): void => {
      if (!this.finish(call)) return;
      this.failedInRow = 0;
      // A still answers a request of the rules, and they read it apart from the stream. So it counts at each time.
      if (order < this.applied && !still) {
        this.deps.debug?.(`recognition result dropped: a newer frame has its result. seq=${seq}`);
      } else {
        this.applied = Math.max(this.applied, order);
        try {
          this.deps.onResult(result, { seq, still, ms: Math.round(performance.now() - startedAt), waitMs });
        } catch (error) {
          // A failure of the rules is no failure of the recognition service, so it does not count toward "slow".
          this.deps.log?.(`recognition result of seq=${seq} failed in the session. ${(error as Error).message}`);
        }
      }
      this.next();
    };

    let answer: Promise<RecognitionResult>;
    try {
      answer = this.deps.recognizer.recognize(frame.jpeg, {
        exclude: this.deps.exclude(), still, signal: abort.signal, view: frame.header.view, context: frame.context,
      });
    } catch (error) {
      // The next frame must start after this stack, so a recognizer that always throws cannot loop here.
      queueMicrotask(() => onError(error));
      return;
    }
    answer.then(onAnswer, onError);
  }

  /** Ends the call and drops its frame. Returns false for a call that was dropped or stopped before. */
  private finish(call: Call): boolean {
    if (!this.calls.delete(call)) return false;
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
    if (this.stopped || this.calls.size >= this.deps.concurrency || !this.waiting) return;
    const entry = this.waiting;
    this.waiting = null;
    this.start(entry);
  }
}
