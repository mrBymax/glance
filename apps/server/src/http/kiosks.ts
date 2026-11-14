import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CreateKioskRequestSchema } from '@glance/shared';
import { kioskTopic } from '../bus';
import type { KioskService } from '../kiosk/kiosks';
import { queryValue, tokenMatches, unauthorized } from './auth';
import { sendEventStream } from './sse';

/**
 * The kiosk paths of spec section 8.1.
 * The events stream needs the token of the kiosk in the query string. A new kiosk needs no token.
 */
export function registerKioskRoutes(app: FastifyInstance, deps: { kiosks: KioskService }): void {
  app.post('/api/kiosks', async (request, reply) => {
    const body = CreateKioskRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    return reply.code(201).send(await deps.kiosks.register(body.data));
  });

  // The first message is the current view, so the page shows its code with no wait for an event.
  app.get('/api/kiosks/:id/events', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params;
    const kiosk = deps.kiosks.get(id);
    if (!kiosk) return reply.code(404).send({ error: 'not_found' });
    if (!tokenMatches(kiosk.token, queryValue(request, 'token'))) return unauthorized(reply);
    return sendEventStream(app, request, reply, (write) => app.bus.subscribe(kioskTopic(id), write), deps.kiosks.view(id));
  });
}
