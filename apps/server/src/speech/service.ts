import type { Lang } from '@glance/shared';
import { type ClipCache, clipKey } from './clips';
import { ELEVENLABS_MODEL, type Synthesize } from './elevenlabs';

/**
 * Makes the function that gives the address of the clip of a line, or null when the line has no clip.
 * It never rejects: a line with no clip still goes out, and the phone reads its text.
 */
export function createClipUrl(deps: {
  /** FAKE_SPEECH: no clip and no call. */
  fake: boolean;
  cache: ClipCache;
  synthesize: Synthesize | null;
  voiceId: { en: string | null; it: string | null };
  /** A function when the address is known only after the server has its port. */
  publicBaseUrl: string | (() => string);
  /** Gets one line for each clip that failed. The default is console.error. */
  log?: (line: string) => void;
}): (text: string, lang: Lang) => Promise<string | null> {
  const log = deps.log ?? ((line: string) => console.error(line));
  /** The requests that run now, by clip key. Two calls for one clip share one request. */
  const running = new Map<string, Promise<boolean>>();

  const make = async (hash: string, text: string, voice: string, synthesize: Synthesize): Promise<boolean> => {
    try {
      await deps.cache.put(hash, await synthesize(text, voice));
      return true;
    } catch (error) {
      log(`speech: no clip. ${(error as Error).message}`);
      return false;
    }
  };

  return async (text, lang) => {
    if (deps.fake || deps.synthesize === null) return null;
    const voice = deps.voiceId[lang] ?? deps.voiceId.en;
    if (voice === null) return null;

    const hash = clipKey(text, lang, voice, ELEVENLABS_MODEL);
    if (!deps.cache.has(hash)) {
      let request = running.get(hash);
      if (!request) {
        // A failed request leaves the map, so the next call for this text tries again.
        request = make(hash, text, voice, deps.synthesize).finally(() => running.delete(hash));
        running.set(hash, request);
      }
      if (!(await request)) return null;
    }
    const base = typeof deps.publicBaseUrl === 'function' ? deps.publicBaseUrl() : deps.publicBaseUrl;
    return `${base.replace(/\/+$/, '')}/api/speech/${hash}.mp3`;
  };
}
