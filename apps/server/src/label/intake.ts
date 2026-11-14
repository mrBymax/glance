import type { FastifyBaseLogger } from 'fastify';
import { TIMING } from '@glance/shared';
import type { BarcodeReport } from '../products/barcodes';
import type { StoreList } from '../products/storeList';
import { saveFrameWith } from '../recognition/intake';
import type { FrameSaver } from '../recognition/save';
import type { SessionRuntime } from '../sessions/runtime';
import { type FrameHandler, frameLogLine } from '../ws/device';
import { matchLabel } from './match';
import type { LabelAnswer, LabelReader } from './reader';

/** One label call has the time of one recognition call. */
export const LABEL_TIMEOUT_MS = TIMING.recognitionTimeoutMs;

const LOGGED_MESSAGE_CHARS = 200;

/**
 * Takes each frame with the kind `label`: one model call reads it, and the answer must select one item of the store list.
 * A match goes the way of a barcode of the phone. Each other end gives the rules the input `label` with `failed`.
 * One call runs at a time for each session, and a label frame that arrives during it is dropped.
 * `stopAll` ends each call, for the close of the app.
 */
export function createLabelHandler(deps: {
  /** null: the server has no reader, and each label frame is dropped. */
  reader: LabelReader | null;
  storeList: StoreList; report: BarcodeReport; log: FastifyBaseLogger;
  /** For a match by brand and name. */
  minConfidence: number;
  /** Drop each frame that did not go through face detection on the phone. */
  requireBlur: boolean;
  saveFrame: FrameSaver | null;
}): FrameHandler & { stopAll(): void } {
  /** The call of each session that runs now. */
  const running = new Map<string, AbortController>();

  const read = async (reader: LabelReader, session: SessionRuntime, jpeg: Uint8Array, seq: number): Promise<void> => {
    const abort = new AbortController();
    running.set(session.id, abort);
    const removeStopListener = session.onStop(() => abort.abort());
    const startedAt = performance.now();
    let timer: NodeJS.Timeout | undefined;
    // The reader gets the signal, and the timer also ends the wait for a reader that does not follow it.
    const late = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new Error(`no answer in ${LABEL_TIMEOUT_MS} ms`));
      }, LABEL_TIMEOUT_MS);
    });

    let gtin: string | null = null;
    try {
      const answer: LabelAnswer = await Promise.race([reader.read(jpeg, { signal: abort.signal }), late]);
      gtin = matchLabel(answer, await deps.storeList.all(), deps.minConfidence);
    } catch (error) {
      const { name, message } = error instanceof Error ? error : { name: 'Error', message: String(error) };
      deps.log.warn(`label call failed. seq=${seq} ${name}: ${message.slice(0, LOGGED_MESSAGE_CHARS)} session=${session.id}`);
    } finally {
      clearTimeout(timer);
      removeStopListener();
      running.delete(session.id);
    }
    if (session.stopped) return;

    deps.log.info(`label session=${session.id} seq=${seq} match=${gtin ?? 'none'} ms=${Math.round(performance.now() - startedAt)}`);
    const result = gtin === null ? 'dropped' : await deps.report(session, gtin, 'label');
    if (result !== 'product' && !session.stopped) session.dispatch({ type: 'label', read: 'failed' });
  };

  const onFrame: FrameHandler = (session, frame) => {
    if (session.stopped) return;
    const { header } = frame;
    deps.log.info(`${frameLogLine(header, frame.jpeg.length)} session=${session.id}`);
    if (deps.requireBlur && !header.blurred) {
      deps.log.warn(`label frame dropped: not blurred session=${session.id}`);
      return;
    }
    if (!deps.reader) {
      deps.log.warn(`label frame dropped: the server has no label reader session=${session.id}`);
      return;
    }
    if (running.has(session.id)) {
      deps.log.warn(`label frame dropped: a label call runs. seq=${header.seq} session=${session.id}`);
      return;
    }
    // The JPEG is a view on the socket message, and the call ends later, so the reader gets a copy.
    const copy = new Uint8Array(frame.jpeg);
    saveFrameWith(deps.saveFrame, deps.log, session.id, { header, jpeg: copy });
    // The voice of recognition is quiet from now on: the shopper shows a barcode.
    session.dispatch({ type: 'label', read: 'started' });
    void read(deps.reader, session, copy, header.seq);
  };

  return Object.assign(onFrame, {
    stopAll: () => {
      for (const abort of running.values()) abort.abort();
      running.clear();
    },
  });
}
