import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Lang } from '@glance/shared';
import type { Store } from '../db/store';

/** The name of a clip: 64 hex characters. One text in one language, voice, and model gives one name. */
export function clipKey(text: string, lang: Lang, voiceId: string, modelId: string): string {
  // The JSON form keeps the four values apart, so no two inputs give the same string.
  return createHash('sha256').update(JSON.stringify([text, lang, voiceId, modelId])).digest('hex');
}

/** The speech clips on disk, one MP3 file for each clip key. The store keeps the path of each file. */
export class ClipCache {
  constructor(private readonly dir: string, private readonly store: Store) {}

  /** The caller checks that `hash` is a clip key. A path part in it would leave the directory. */
  path(hash: string): string {
    return join(this.dir, `${hash}.mp3`);
  }

  has(hash: string): boolean {
    return existsSync(this.path(hash));
  }

  async put(hash: string, mp3: Uint8Array): Promise<void> {
    const path = this.path(hash);
    // A reader must never get a part of a file, so the bytes go to a temp file that then takes the name.
    const temp = join(this.dir, `${hash}.${randomUUID()}.tmp`);
    await mkdir(this.dir, { recursive: true });
    try {
      await writeFile(temp, mp3);
      await rename(temp, path);
      await this.store.putClip({ _id: hash, path });
    } catch (error) {
      await rm(temp, { force: true });
      await rm(path, { force: true });
      throw error;
    }
  }
}
