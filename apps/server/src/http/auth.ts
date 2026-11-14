import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Compares a token in constant time. False for a value that is no string, and for another length.
 * A query string with two `token` keys gives an array, which is no string.
 */
export function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const want = Buffer.from(expected);
  const got = Buffer.from(given);
  // timingSafeEqual throws for two lengths. The length of a token is no secret.
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Reads one key of the query string. The token and the demo key travel there (spec section 8.1). */
export function queryValue(request: FastifyRequest, name: string): unknown {
  return (request.query as Record<string, unknown> | null)?.[name];
}

export function unauthorized(reply: FastifyReply): FastifyReply {
  return reply.code(401).send({ error: 'unauthorized' });
}

/** The path of a request address with no query string. The log gets this, because the query string holds the token. */
export function pathOnly(url: string): string {
  const end = url.indexOf('?');
  return end < 0 ? url : url.slice(0, end);
}
