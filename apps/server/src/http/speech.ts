import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ClipCache } from '../speech/clips';

const CLIP_FILE = /^([0-9a-f]{64})\.mp3$/;
/** A clip never changes: its name is the hash of its text, language, voice, and model. */
const CACHE_FOREVER = 'public, max-age=31536000, immutable';

/**
 * GET /api/speech/<hash>.mp3 of spec section 8.1. It needs no token.
 * With `fake` (FAKE_SPEECH) the path answers 404 for each name.
 */
export function registerSpeechRoutes(app: FastifyInstance, deps: { cache: ClipCache; fake: boolean }): void {
  app.get('/api/speech/:file', async (request: FastifyRequest<{ Params: { file: string } }>, reply) => {
    // The name becomes a part of a file path, so each other name stops here, before the server reads a file.
    const hash = deps.fake ? undefined : CLIP_FILE.exec(request.params.file)?.[1];
    if (hash === undefined || !deps.cache.has(hash)) return reply.code(404).send({ error: 'not_found' });
    return reply
      .header('content-type', 'audio/mpeg')
      .header('cache-control', CACHE_FOREVER)
      .send(createReadStream(deps.cache.path(hash)));
  });
}
