import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Frame } from './worker';

/** Rejects when the write fails. The caller logs it and goes on. */
export type FrameSaver = (sessionId: string, frame: Frame) => Promise<void>;

// The session ID becomes a folder name. The server makes each ID with randomUUID().
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Writes each frame to <dir>/<sessionId>/<seq>.jpg, for the test set of the replay tool.
 * A crop of the phone gets the name <seq>.crop.jpg, so a person can tell it from a full frame. The file is the
 * JPEG as the phone sent it. The context image of a crop goes to <seq>.context.jpg.
 * This is the only file on the frame path that touches the file system, and the server makes a saver only when SAVE_FRAMES is set.
 * A frame with a sequence number that the folder already holds replaces the older file.
 */
export function createFrameSaver(dir: string): FrameSaver {
  return async (sessionId, frame) => {
    if (!SAFE_NAME.test(sessionId)) throw new Error('The session ID is no safe folder name.');
    const folder = join(dir, sessionId);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${frame.header.seq}${frame.header.view === 'crop' ? '.crop' : ''}.jpg`), frame.jpeg);
    if (frame.context) await writeFile(join(folder, `${frame.header.seq}.context.jpg`), frame.context);
  };
}
