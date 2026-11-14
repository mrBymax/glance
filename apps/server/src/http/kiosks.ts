import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CreateKioskRequestSchema } from '@glance/shared';
import { kioskTopic } from '../bus';
import type { KioskService } from '../kiosk/kiosks';
import { sendEventStream } from './sse';

/**
 * The kiosk paths of spec section 8.1.
 * No path checks the token yet.
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
    if (!deps.kiosks.get(id)) return reply.code(404).send({ error: 'not_found' });
    return sendEventStream(app, request, reply, (write) => app.bus.subscribe(kioskTopic(id), write), deps.kiosks.view(id));
  });
}
