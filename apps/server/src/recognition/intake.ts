import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock';
import type { SessionRuntime } from '../sessions/runtime';
import { excludeList } from '../sessions/view';
import type { FrameHandler } from '../ws/device';
import type { Recognizer } from './gemini';
import { RecognitionWorker } from './worker';

type Intake = { worker: RecognitionWorker | null; warnedAboutBlur: boolean };

/**
 * Gives the frames of each phone to the recognition worker of its session, and the results to the rules.
 * `stopAll` ends each call, for the close of the app.
 */
export function createFrameHandler(deps: {
  recognizer: Recognizer; clock: Clock; log: FastifyBaseLogger;
  /** 3 recognition calls of the session failed in a row. */
  onSlow: (session: SessionRuntime) => void;
  /** Drop each frame that did not go through face detection on the phone. */
  requireBlur: boolean;
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
    intake.worker.submit({ header: frame.header, jpeg: new Uint8Array(frame.jpeg) });
  };

  return Object.assign(onFrame, {
    stopAll: () => {
      for (const intake of intakes.values()) intake.worker?.stop();
      intakes.clear();
    },
  });
}
