import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock';
import type { SessionRuntime } from '../sessions/runtime';
import { excludeList } from '../sessions/view';
import { type FrameHandler, frameLogLine } from '../ws/device';
import type { Recognizer } from './gemini';
import type { FrameSaver } from './save';
import { type Frame, RecognitionWorker } from './worker';

type Intake = { worker: RecognitionWorker | null; warnedAboutBlur: boolean };

/** Saves a frame when a saver exists. A write that fails is logged, and the caller goes on. */
export function saveFrameWith(saveFrame: FrameSaver | null, log: Pick<FastifyBaseLogger, 'warn'>, sessionId: string, frame: Frame): void {
  if (!saveFrame) return;
  const failed = (error: unknown): void => {
    log.warn(`frame not saved. seq=${frame.header.seq} ${error instanceof Error ? error.message : String(error)} session=${sessionId}`);
  };
  try {
    saveFrame(sessionId, frame).catch(failed);
  } catch (error) {
    failed(error);
  }
}

/**
 * Gives the frames of each phone to the recognition worker of its session, and the results to the rules.
 * `stopAll` ends each call, for the close of the app.
 */
export function createFrameHandler(deps: {
  /**
   * The recognizer of a session. The frame pipeline has one recognizer for each session. The observe pipeline
   * makes one for each session, because it tracks the held product over the frames.
   */
  recognizerFor: (session: SessionRuntime) => Recognizer;
  clock: Clock; log: FastifyBaseLogger;
  /** The number of recognition calls that one session runs at the same time. */
  concurrency: number;
  /** Gets the digits of the code of a result, as the model read them. */
  onCode: (session: SessionRuntime, digits: string) => void;
  /**
   * For a product that a result names. Returns null for a catalog product: the rules have it.
   * For a store item it reads the product again, with the details of the product database, and resolves false
   * when the store no longer sells it. A read that fails rejects.
   */
  resolveProduct: (productId: string) => Promise<boolean> | null;
  /** 3 recognition calls of the session failed in a row. */
  onSlow: (session: SessionRuntime) => void;
  /** Drop each frame that did not go through face detection on the phone. */
  requireBlur: boolean;
  /** Writes each accepted frame to disk. null without SAVE_FRAMES: the frame then lives in memory only, until its call ends. */
  saveFrame: FrameSaver | null;
}): FrameHandler & { stopAll(): void } {
  const intakes = new Map<string, Intake>();

  const intakeOf = (session: SessionRuntime): Intake => {
    let intake = intakes.get(session.id);
    if (!intake) {
      const made: Intake = { worker: null, warnedAboutBlur: false };
      intake = made;
      intakes.set(session.id, made);
      session.onStop(() => {
        made.worker?.stop();
        intakes.delete(session.id);
      });
    }
    return intake;
  };

  const makeWorker = (session: SessionRuntime): RecognitionWorker => new RecognitionWorker({
    recognizer: deps.recognizerFor(session),
    concurrency: deps.concurrency,
    exclude: () => excludeList(session.state, deps.clock.now()),
    onResult: (result, info) => {
      // These lines give the server share of the time from glance to voice.
      deps.log.info(`recognition session=${session.id} seq=${info.seq} status=${result.status} code=${result.code.digits ?? (result.code.visible ? "visible" : "no")} ms=${info.ms}`);
      const resultAt = performance.now();
      const give = (): void => {
        if (session.stopped) return;
        session.dispatch({ type: 'recognition', result, still: info.still }, {
          frameToResultMs: info.waitMs + info.ms, resolveMs: Math.round(performance.now() - resultAt),
        });
        if (result.code.digits !== null) deps.onCode(session, result.code.digits);
      };
      const read = result.productId === null ? null : deps.resolveProduct(result.productId);
      if (read === null) {
        give();
        return;
      }
      // The prompt of a store item needs its allergens, so the result waits for the read. With the details in the cache,
      // the read takes no time. Else it has the time of a barcode lookup, and a result of a later frame can reach the rules first.
      const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
      read.catch((error: unknown) => {
        // The rules still hold the product from the start of the server, with the details of that time.
        deps.log.warn(`product not read again. id=${result.productId} ${message(error)} session=${session.id}`);
        return true;
      }).then((sold) => {
        if (sold) give();
        else deps.log.warn(`recognition result dropped: the store does not sell ${result.productId}. seq=${info.seq} session=${session.id}`);
      }).catch((error: unknown) => {
        // As in the worker: a failure of the rules is no failure of the recognition service.
        deps.log.warn(`recognition result of seq=${info.seq} failed in the session. ${message(error)} session=${session.id}`);
      });
    },
    onSlow: () => deps.onSlow(session),
    log: (line) => deps.log.warn(`${line} session=${session.id}`),
    debug: (line) => deps.log.debug(`${line} session=${session.id}`),
  });

  const onFrame: FrameHandler = (session, frame) => {
    if (session.stopped) return;
    const intake = intakeOf(session);

    if (!frame.header.blurred) {
      if (!intake.warnedAboutBlur) {
        intake.warnedAboutBlur = true;
        deps.log.warn(deps.requireBlur
          ? `frame dropped: not blurred session=${session.id}`
          : `frame not blurred: the phone did not run face detection session=${session.id}`);
      }
      if (deps.requireBlur) return;
    }

    intake.worker ??= makeWorker(session);
    // The JPEG and the context image are views on the socket message. The worker keeps the frame for the time of a call, so it gets copies.
    const copy: Frame = {
      header: frame.header, jpeg: new Uint8Array(frame.jpeg), ...(frame.context ? { context: new Uint8Array(frame.context) } : {}),
    };
    deps.log.debug(`${frameLogLine(copy.header, copy.jpeg.length)} session=${session.id}`);
    saveFrameWith(deps.saveFrame, deps.log, session.id, copy);
    intake.worker.submit(copy);
  };

  return Object.assign(onFrame, {
    stopAll: () => {
      for (const intake of intakes.values()) intake.worker?.stop();
      intakes.clear();
    },
  });
}
