import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  CartEditRequestSchema, type CreateSessionResponse, CreateSessionRequestSchema, ProfilePatchSchema, WebIntentRequestSchema,
} from '@glance/shared';
import { sessionTopic } from '../bus';
import type { SessionRuntime } from '../sessions/runtime';
import { sendEventStream } from './sse';

type SessionRequest = FastifyRequest<{ Params: { id: string } }>;

/** `http` becomes `ws`, and `https` becomes `wss`. */
export function deviceSocketUrl(publicBaseUrl: string, sessionId: string, token: string): string {
  const base = publicBaseUrl.replace(/^http/, 'ws').replace(/\/+$/, '');
  return `${base}/ws/device?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
}

/**
 * The session paths of spec section 8.1.
 * An intent or a cart edit gets 204 when the server took the input. Its outcome arrives as events.
 * No path checks the token yet.
 */
export function registerSessionRoutes(app: FastifyInstance, deps: {
  publicBaseUrl: () => string;
  /** Runs when a client opens the events stream of a live session, after the stream listens to the bus. */
  onEventsOpen: (session: SessionRuntime) => void;
}): void {
  const badRequest = (reply: FastifyReply) => reply.code(400).send({ error: 'bad_request' });

  /** Answers 404 and returns null for an unknown session. */
  const find = async (request: SessionRequest, reply: FastifyReply): Promise<SessionRuntime | null> => {
    const session = await app.sessions.get(request.params.id);
    if (!session) await reply.code(404).send({ error: 'not_found' });
    return session;
  };

  /** Answers 400 and returns null for a body that fails the schema. */
  const parse = <S extends z.ZodType>(schema: S, body: unknown, reply: FastifyReply): z.infer<S> | null => {
    const parsed = schema.safeParse(body);
    if (parsed.success) return parsed.data;
    badRequest(reply);
    return null;
  };

  app.post('/api/sessions', async (request, reply) => {
    const body = parse(CreateSessionRequestSchema, request.body ?? {}, reply);
    if (!body) return reply;
    const session = await app.sessions.create(body.profile);
    const answer: CreateSessionResponse = {
      sessionId: session.id,
      token: session.token,
      wsUrl: deviceSocketUrl(deps.publicBaseUrl(), session.id, session.token),
    };
    return reply.code(201).send(answer);
  });

  app.get('/api/sessions/:id', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    return session.snapshot();
  });

  app.patch('/api/sessions/:id/profile', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    const patch = parse(ProfilePatchSchema, request.body, reply);
    if (!patch) return reply;
    session.dispatch({ type: 'profile.set', patch });
    return session.state.profile;
  });

  app.post('/api/sessions/:id/intents', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    const intent = parse(WebIntentRequestSchema, request.body, reply);
    if (!intent) return reply;
    session.dispatch({ type: 'intent', ...intent });
    return reply.code(204).send();
  });

  app.post('/api/sessions/:id/cart', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    const edit = parse(CartEditRequestSchema, request.body, reply);
    if (!edit) return reply;
    session.dispatch({ type: 'cart.edit', ...edit });
    return reply.code(204).send();
  });

  // A web client opens this stream first and then gets the snapshot. No event is lost that way.
  app.get('/api/sessions/:id/events', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    return sendEventStream(app, request, reply, (write, end) => {
      const unsubscribe = app.bus.subscribe(sessionTopic(session.id), write);
      // A session that is paid or ended has stopped, and it still has a receipt to show. Its stream stays open,
      // because a browser opens a stream again each time the stream ends.
      const removeStopListener = session.stopped ? () => undefined : session.onStop(end);
      // The stream listens to the bus now, so the client gets the first events of a script player.
      if (!session.stopped) deps.onEventsOpen(session);
      return () => {
        unsubscribe();
        removeStopListener();
      };
    });
  });

  app.delete('/api/sessions/:id', async (request: SessionRequest, reply) => {
    const session = await find(request, reply);
    if (!session) return reply;
    session.end();
    await app.sessions.remove(session.id);
    return reply.code(204).send();
  });
}
