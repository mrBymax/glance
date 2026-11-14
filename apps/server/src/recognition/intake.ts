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
  recognizer: Recognizer; clock: Clock; log: FastifyBaseLogger;
  /** Gets the digits of the code of a result, as the model read them. */
  onCode: (session: SessionRuntime, digits: string) => void;
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
    recognizer: deps.recognizer,
    exclude: () => excludeList(session.state, deps.clock.now()),
    onResult: (result, info) => {
      // These lines give the server share of the time from glance to voice.
      deps.log.info(`recognition session=${session.id} seq=${info.seq} status=${result.status} ms=${info.ms}`);
      session.dispatch({ type: 'recognition', result, still: info.still });
      if (result.code.digits !== null) deps.onCode(session, result.code.digits);
    },
    onSlow: () => deps.onSlow(session),
    log: (line) => deps.log.warn(`${line} session=${session.id}`),
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
    // The JPEG is a view on the socket message. The worker keeps the frame for the time of a call, so it gets a copy.
    const copy: Frame = { header: frame.header, jpeg: new Uint8Array(frame.jpeg) };
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
