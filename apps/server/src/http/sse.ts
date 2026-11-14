import { PassThrough } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const PING_EVERY_MS = 15_000;
// A line that starts with a colon is a comment. A client ignores it, and a proxy sees that the stream lives.
const PING = ': ping\n\n';

/**
 * Answers a request with a stream of server-sent events.
 * `subscribe` gets `write`, which sends one message, and `end`, which ends the stream. It returns its unsubscribe function.
 * The stream ends when the client leaves, when `end` runs, or when the app closes.
 */
export function sendEventStream(
  app: FastifyInstance, request: FastifyRequest, reply: FastifyReply,
  subscribe: (write: (message: unknown) => void, end: () => void) => () => void,
  /** Sent before each other message. */
  first?: unknown,
): FastifyReply {
  // No reply.hijack(): the reply must keep the CORS header of the onRequest hook.
  const stream = new PassThrough();
  let ended = false;
  let unsubscribe: () => void = () => undefined;

  const write = (message: unknown): void => {
    if (!ended) stream.write(`data: ${JSON.stringify(message)}\n\n`);
  };
  const end = (): void => {
    if (ended) return;
    ended = true;
    clearInterval(ping);
    unsubscribe();
    app.closers.delete(end);
    stream.end();
  };
  const ping = setInterval(() => stream.write(PING), PING_EVERY_MS);

  // The client sees an open stream at once, before the first event.
  stream.write(PING);
  if (first !== undefined) write(first);

  const stop = subscribe(write, end);
  // `subscribe` can call `end` before it returns. Then the subscription must stop here.
  if (ended) stop();
  else unsubscribe = stop;

  app.closers.add(end);
  // The request emits "close" when its body is read, so the response tells when the client has left.
  reply.raw.on('close', end);

  return reply
    .header('content-type', 'text/event-stream')
    .header('cache-control', 'no-cache')
    .send(stream);
}
