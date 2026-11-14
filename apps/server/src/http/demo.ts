import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type LatestSessionResponse, normalizeGtin } from '@glance/shared';
import { type CapturedReference, ReferenceCaptureError } from '../label/intake';
import type { StoreList } from '../products/storeList';
import type { ReferenceImages } from '../reference/images';
import type { SessionRuntime } from '../sessions/runtime';
import { queryValue, tokenMatches } from './auth';

/** The answer of POST /api/demo/reference: the picture that the server saved. `count` is the number of pictures of the item. */
export type ReferenceSavedResponse = { gtin: string; name: string } & CapturedReference;
/** The answer of GET /api/demo/reference. `name` is null for pictures of a code that the store list does not hold. */
export type ReferenceListResponse = { items: { gtin: string; name: string | null; pictures: number }[] };

const CAPTURE_STATUS: Record<ReferenceCaptureError['reason'], [number, string]> = {
  timeout: [504, 'timeout'], replaced: [409, 'replaced'], stopped: [409, 'no_session'], failed: [500, 'internal'],
};

/**
 * The paths of a demo. Each one needs ?key=<DEMO_KEY>. Without DEMO_KEY and with a wrong key, each path answers 404,
 * so a caller cannot tell these cases apart.
 *
 * GET /api/demo/latest: the ID and the token of the newest live session. The mirror page follows the session of the
 * phone with it, with no typed ID. With no live session it answers 404 too.
 *
 * POST /api/demo/reference?gtin=<digits>: marks the newest live session and asks its phone for one still.
 * The next label frame of that session becomes a reference picture of the store item, and the answer comes when
 * the picture is saved. GET lists each store item with its picture count, and DELETE removes the pictures of one item.
 */
export function registerDemoRoutes(app: FastifyInstance, deps: {
  demoKey: string | null; storeList: StoreList; references: ReferenceImages;
  /** Marks a session: its next label frame is a reference picture of the item. Rejects with a ReferenceCaptureError. */
  capture: (session: SessionRuntime, gtin: string) => Promise<CapturedReference>;
}): void {
  const keyMatches = (request: FastifyRequest): boolean => deps.demoKey !== null && tokenMatches(deps.demoKey, queryValue(request, 'key'));
  const notFound = (reply: FastifyReply): FastifyReply => reply.code(404).send({ error: 'not_found' });
  /** 13 digits, or null for a query with no code or with a wrong check digit. */
  const gtinOf = (request: FastifyRequest): string | null => {
    const gtin = queryValue(request, 'gtin');
    return typeof gtin === 'string' ? normalizeGtin(gtin) : null;
  };

  app.get('/api/demo/latest', async (request, reply) => {
    // live() is in the order in which this process got the sessions, so its last entry is the newest session.
    const session = keyMatches(request) ? app.sessions.live().at(-1) : undefined;
    if (!session) return notFound(reply);
    const answer: LatestSessionResponse = { sessionId: session.id, token: session.token };
    return answer;
  });

  app.post('/api/demo/reference', async (request, reply) => {
    if (!keyMatches(request)) return notFound(reply);
    const gtin = gtinOf(request);
    const item = gtin === null ? undefined : await deps.storeList.byGtin(gtin);
    if (gtin === null || !item) return reply.code(400).send({ error: 'bad_request' });
    const session = app.sessions.live().at(-1);
    if (!session) return reply.code(409).send({ error: 'no_session' });
    // With no phone, no still can come, and the caller must not wait 15 seconds for that.
    if (!session.connected) return reply.code(409).send({ error: 'no_phone' });

    const captured = deps.capture(session, gtin);
    session.requestStill('reference');
    try {
      const answer: ReferenceSavedResponse = { gtin, name: item.name, ...await captured };
      return await reply.code(201).send(answer);
    } catch (error) {
      if (!(error instanceof ReferenceCaptureError)) throw error;
      const [status, name] = CAPTURE_STATUS[error.reason];
      return reply.code(status).send({ error: name });
    }
  });

  app.get('/api/demo/reference', async (request, reply) => {
    if (!keyMatches(request)) return notFound(reply);
    const pictures = await deps.references.all();
    const items: ReferenceListResponse['items'] = (await deps.storeList.all())
      .map((item) => ({ gtin: item.gtin, name: item.name, pictures: pictures.get(item.gtin)?.length ?? 0 }));
    const sold = new Set(items.map((item) => item.gtin));
    for (const [gtin, list] of pictures) if (!sold.has(gtin)) items.push({ gtin, name: null, pictures: list.length });
    const answer: ReferenceListResponse = { items };
    return answer;
  });

  app.delete('/api/demo/reference', async (request, reply) => {
    if (!keyMatches(request)) return notFound(reply);
    const gtin = gtinOf(request);
    if (gtin === null) return reply.code(400).send({ error: 'bad_request' });
    return { gtin, removed: await deps.references.remove(gtin) };
  });
}
