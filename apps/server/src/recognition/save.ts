import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Frame } from './worker';

/** Rejects when the write fails. The caller logs it and goes on. */
export type FrameSaver = (sessionId: string, frame: Frame) => Promise<void>;

// The session ID becomes a folder name. The server makes each ID with randomUUID().
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Writes each frame to <dir>/<sessionId>/<seq>.jpg, for the test set of the replay tool.
 * This is the only file on the frame path that touches the file system, and the server makes a saver only when SAVE_FRAMES is set.
 * A frame with a sequence number that the folder already holds replaces the older file.
 */
export function createFrameSaver(dir: string): FrameSaver {
  return async (sessionId, frame) => {
    if (!SAFE_NAME.test(sessionId)) throw new Error('The session ID is no safe folder name.');
    const folder = join(dir, sessionId);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${frame.header.seq}.jpg`), frame.jpeg);
  };
}
