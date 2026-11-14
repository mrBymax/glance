import type { FastifyInstance } from 'fastify';
import type { LatestSessionResponse } from '@glance/shared';
import { queryValue, tokenMatches } from './auth';

/**
 * GET /api/demo/latest?key=<DEMO_KEY>: the ID and the token of the newest live session.
 * The mirror page follows the session of the phone with it, with no typed ID.
 * Without DEMO_KEY, with a wrong key, and with no live session, the path answers 404, so a caller cannot tell these cases apart.
 */
export function registerDemoRoutes(app: FastifyInstance, deps: { demoKey: string | null }): void {
  app.get('/api/demo/latest', async (request, reply) => {
    // live() is in the order in which this process got the sessions, so its last entry is the newest session.
    const session = deps.demoKey !== null && tokenMatches(deps.demoKey, queryValue(request, 'key')) ? app.sessions.live().at(-1) : undefined;
    if (!session) return reply.code(404).send({ error: 'not_found' });
    const answer: LatestSessionResponse = { sessionId: session.id, token: session.token };
    return answer;
  });
}
