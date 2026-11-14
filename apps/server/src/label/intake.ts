import type { FastifyBaseLogger } from 'fastify';
import { TIMING } from '@glance/shared';
import type { Clock } from '../clock';
import type { BarcodeReport } from '../products/barcodes';
import type { StoreList } from '../products/storeList';
import { type ReferenceImages, selectReferences } from '../reference/images';
import { saveFrameWith } from '../recognition/intake';
import type { FrameSaver } from '../recognition/save';
import type { SessionRuntime } from '../sessions/runtime';
import { type FrameHandler, frameLogLine } from '../ws/device';
import { matchLabel } from './match';
import type { LabelAnswer, LabelReader, LabelReference } from './reader';

/** One label call has the time of one recognition call. */
export const LABEL_TIMEOUT_MS = TIMING.recognitionTimeoutMs;

/**
 * A session starts at most one label call in this time. The phone takes at most one still each 6 seconds,
 * and each label call costs money, so a phone that sends more must not cause more calls.
 * The value is below 6 seconds because the network can bring two stills closer together.
 */
export const LABEL_EVERY_MS = 5000;

/** A mark for a reference picture ends after this time with no label frame. */
export const REFERENCE_CAPTURE_MS = 15_000;

const LOGGED_MESSAGE_CHARS = 200;

/** A reference picture as the capture saved it. `count` is the number of pictures that the item has now. */
export type CapturedReference = { file: string; bytes: number; width: number; height: number; count: number };

/**
 * Why a mark gave no reference picture: no label frame came in 15 seconds, a new mark of the session took its place,
 * the session stopped, or the store did not write the picture.
 */
export class ReferenceCaptureError extends Error {
  constructor(readonly reason: 'timeout' | 'replaced' | 'stopped' | 'failed') {
    super(`No reference picture: ${reason}.`);
  }
}

type Mark = { gtin: string; resolve: (captured: CapturedReference) => void; end: (reason: ReferenceCaptureError['reason']) => void };

/**
 * Takes each frame with the kind `label`: one model call reads it, and the answer must select one item of the store list.
 * A match goes the way of a barcode of the phone. An answer with no digits, no brand, no name, and no item gives the rules
 * the input `label` with `empty`: the still showed no product, so the voice says nothing. Each other end gives `failed`.
 * One call runs at a time for each session, and a session starts at most one call each 5 seconds.
 * A label frame that arrives too early, or for a session that does not shop, is dropped with no call.
 * `capture` marks a session: its next label frame becomes a reference picture of one store item, with no call
 * and no input for the rules. `stopAll` ends each call and each mark, for the close of the app.
 */
export function createLabelHandler(deps: {
  /** null: the server has no reader, and each label frame is dropped. */
  reader: LabelReader | null;
  storeList: StoreList; report: BarcodeReport; log: FastifyBaseLogger; clock: Clock;
  /** For a match by brand and name. */
  minConfidence: number;
  /** For the item that the model chose from the store list. */
  minItemConfidence: number;
  /** Drop each frame that did not go through face detection on the phone. */
  requireBlur: boolean;
  saveFrame: FrameSaver | null;
  /** The reference pictures of the store items. null: the label call gets the still alone, and no capture works. */
  references: ReferenceImages | null;
}): FrameHandler & { stopAll(): void; capture(session: SessionRuntime, gtin: string): Promise<CapturedReference> } {
  /** The call of each session that runs now. */
  const running = new Map<string, AbortController>();
  /** The start of the last call of each session, for the last 5 seconds. */
  const startedAt = new Map<string, number>();
  /** The mark of each session that waits for its label frame. */
  const marks = new Map<string, Mark>();

  /** The pictures of one label call. A store that fails costs the pictures, not the call. */
  const referencesFor = async (store: ReferenceImages, sessionId: string): Promise<LabelReference[]> => {
    try {
      const names = new Map((await deps.storeList.all()).map((item) => [item.gtin, item.name]));
      const selected = selectReferences(await store.all(), [...names.keys()]);
      return await Promise.all(selected.map(async (picture) => ({
        gtin: picture.gtin, name: names.get(picture.gtin)!, jpeg: await store.read(picture),
      })));
    } catch (error) {
      deps.log.warn(`reference pictures not read. ${error instanceof Error ? error.message : String(error)} session=${sessionId}`);
      return [];
    }
  };

  const saveReference = async (store: ReferenceImages, mark: Mark, session: SessionRuntime, header: { seq: number; w: number; h: number }, jpeg: Uint8Array): Promise<void> => {
    try {
      const picture = await store.add(mark.gtin, jpeg);
      const count = (await store.list(mark.gtin)).length;
      deps.log.info(`reference picture saved. gtin=${mark.gtin} file=${picture.file} bytes=${picture.bytes} seq=${header.seq} session=${session.id}`);
      mark.resolve({ file: picture.file, bytes: picture.bytes, width: header.w, height: header.h, count });
    } catch (error) {
      deps.log.warn(`reference picture not saved. gtin=${mark.gtin} ${error instanceof Error ? error.message : String(error)} session=${session.id}`);
      mark.end('failed');
    }
  };

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
    let empty = false;
    let referenceCount = 0;
    try {
      const { references: store } = deps;
      const reading = store === null
        ? reader.read(jpeg, { signal: abort.signal })
        : referencesFor(store, session.id).then((references) => {
          referenceCount = references.length;
          return reader.read(jpeg, { signal: abort.signal, references });
        });
      const answer: LabelAnswer = await Promise.race([reading, late]);
      // What the model read, so that a person can see why a still gave no product.
      deps.log.info(`label answer seq=${seq} digits=${JSON.stringify(answer.digits)} brand=${JSON.stringify(answer.brand)} name=${JSON.stringify(answer.name)} confidence=${answer.confidence} item=${answer.item ?? 'null'} itemConfidence=${answer.itemConfidence} session=${session.id}`);
      empty = answer.digits.length === 0 && answer.brand === null && answer.name === null && answer.item === null;
      gtin = matchLabel(answer, await deps.storeList.all(), deps.minConfidence, deps.minItemConfidence);
    } catch (error) {
      const { name, message } = error instanceof Error ? error : { name: 'Error', message: String(error) };
      deps.log.warn(`label call failed. seq=${seq} ${name}: ${message.slice(0, LOGGED_MESSAGE_CHARS)} session=${session.id}`);
    } finally {
      clearTimeout(timer);
      removeStopListener();
      running.delete(session.id);
    }
    if (session.stopped) return;

    deps.log.info(`label session=${session.id} seq=${seq} match=${gtin ?? 'none'} ms=${Math.round(performance.now() - startedAt)} references=${referenceCount}`);
    const result = gtin === null ? 'dropped' : await deps.report(session, gtin, 'label');
    if (result !== 'product' && !session.stopped) session.dispatch({ type: 'label', read: empty ? 'empty' : 'failed' });
  };

  const onFrame: FrameHandler = (session, frame) => {
    if (session.stopped) return;
    const { header } = frame;
    deps.log.info(`${frameLogLine(header, frame.jpeg.length)} session=${session.id}`);
    if (deps.requireBlur && !header.blurred) {
      deps.log.warn(`label frame dropped: not blurred session=${session.id}`);
      return;
    }
    const mark = marks.get(session.id);
    if (mark && deps.references) {
      // One frame ends the mark. The JPEG is a view on the socket message, and the write ends later, so the store gets a copy.
      marks.delete(session.id);
      void saveReference(deps.references, mark, session, header, new Uint8Array(frame.jpeg));
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
    // The rules take no label input in each other phase, so the call would cost money for nothing.
    const { phase } = session.state;
    if (phase !== 'shopping' && phase !== 'checkout') {
      deps.log.warn(`label frame dropped: the session does not shop. seq=${header.seq} session=${session.id}`);
      return;
    }
    const now = deps.clock.now();
    for (const [id, at] of startedAt) if (now - at >= LABEL_EVERY_MS) startedAt.delete(id);
    const last = startedAt.get(session.id);
    if (last !== undefined) {
      deps.log.warn(`label frame dropped: the last label call started ${now - last} ms ago. seq=${header.seq} session=${session.id}`);
      return;
    }
    startedAt.set(session.id, now);
    // The JPEG is a view on the socket message, and the call ends later, so the reader gets a copy.
    const copy = new Uint8Array(frame.jpeg);
    saveFrameWith(deps.saveFrame, deps.log, session.id, { header, jpeg: copy });
    // The voice of recognition is quiet from now on: the shopper shows a barcode.
    session.dispatch({ type: 'label', read: 'started' });
    void read(deps.reader, session, copy, header.seq);
  };

  const capture = (session: SessionRuntime, gtin: string): Promise<CapturedReference> => new Promise((resolve, reject) => {
    marks.get(session.id)?.end('replaced');
    let removeStopListener: () => void = () => undefined;
    const timer = setTimeout(() => mark.end('timeout'), REFERENCE_CAPTURE_MS);
    const settle = (): void => {
      clearTimeout(timer);
      removeStopListener();
      if (marks.get(session.id) === mark) marks.delete(session.id);
    };
    const mark: Mark = {
      gtin,
      resolve: (captured) => {
        settle();
        resolve(captured);
      },
      end: (reason) => {
        settle();
        reject(new ReferenceCaptureError(reason));
      },
    };
    marks.set(session.id, mark);
    removeStopListener = session.onStop(() => mark.end('stopped'));
  });

  return Object.assign(onFrame, {
    capture,
    stopAll: () => {
      for (const abort of running.values()) abort.abort();
      running.clear();
      for (const mark of [...marks.values()]) mark.end('stopped');
    },
  });
}
