import Fastify, { type FastifyInstance } from 'fastify';
import { EventBus } from './bus';
import type { CatalogIndex } from './catalog/catalog';
import type { Clock } from './clock';
import type { Config } from './config';
import type { Store } from './db/store';
import { registerSessionRoutes } from './http/sessions';
import { ScriptPlayer, readFakeScript } from './recognition/fake';
import type { Recognizer } from './recognition/gemini';
import { createFrameHandler } from './recognition/intake';
import { SessionRegistry } from './sessions/registry';
import { type FrameHandler, registerDeviceSocket } from './ws/device';

export type AppDeps = {
  config: Config; clock: Clock; store: Store; catalog: CatalogIndex;
  /** false gives no log. An object sends each log line to its stream. */
  log?: boolean | { level: string; stream: { write(line: string): void } };
  /** Names the product of each frame. Fake recognition does not use it. */
  recognizer?: Recognizer;
  /** Gets each frame of each phone, in place of the recognizer. With neither, the server drops the frames. */
  onFrame?: FrameHandler;
};

type Closer = () => void | Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Functions that end the open streams and sockets. The app runs them when it closes.
     * Without them, close() does not return while a client is connected.
     */
    closers: Set<Closer>;
    sessions: SessionRegistry;
    bus: EventBus;
  }
}

const ERROR_NAMES: Record<number, string> = { 400: 'bad_request', 401: 'unauthorized', 404: 'not_found' };

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  // A script that the server cannot use stops the start, before a timer or a socket exists.
  const fakeScript = config.fakeRecognition === null ? null : readFakeScript(config.fakeRecognition, deps.catalog);
  const app = Fastify({ logger: deps.log ?? true });

  app.decorate('closers', new Set<Closer>());
  app.addHook('preClose', async () => {
    const closers = [...app.closers];
    app.closers.clear();
    await Promise.all(closers.map((close) => close()));
  });

  // Tokens travel in the query string and the server sets no cookie, so each origin can read an answer.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', '*');
    if (request.method === 'OPTIONS') {
      reply.header('access-control-allow-methods', 'GET,POST,PATCH,DELETE');
      reply.header('access-control-allow-headers', 'content-type');
      return reply.code(204).send();
    }
  });

  // The parser of Fastify rejects an empty body. A client can send the JSON content type with each call,
  // also with a DELETE that has no body, so an empty body counts as no body here.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    if (body === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(Object.assign(new Error('The body is not valid JSON.'), { statusCode: 400 }));
    }
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));
  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'internal' });
    }
    // Fastify reports a body that it cannot parse, and a body of the wrong type, with a 4xx status.
    const name = ERROR_NAMES[status];
    return name ? reply.code(status).send({ error: name }) : reply.code(400).send({ error: 'bad_request' });
  });

  const bus = new EventBus();
  const sessions = new SessionRegistry({
    clock: deps.clock,
    catalog: deps.catalog,
    store: deps.store,
    bus,
    // No speech clip and no payment exist yet. A line goes out with its text alone.
    clipUrl: async () => null,
    startPayment: () => undefined,
    afterStep: () => undefined,
  });
  app.decorate('bus', bus);
  app.decorate('sessions', sessions);
  sessions.startTicks();
  app.closers.add(() => sessions.stop());

  app.get('/healthz', async () => ({
    ok: true,
    fakeRecognition: config.fakeRecognition !== null,
    fakeSpeech: config.fakeSpeech,
    store: config.mongodbUri === null ? 'memory' : 'mongodb',
  }));

  // With fake recognition, one script player stands for the frames and the recognition calls of each session.
  const player = fakeScript === null ? null : new ScriptPlayer({ script: fakeScript, clock: deps.clock, onKiosk: () => undefined });
  if (player) app.closers.add(() => player.stopAll());
  const logFrame: FrameHandler = (_session, { header, jpeg }) => {
    app.log.info(
      `frame seq=${header.seq} w=${header.w} h=${header.h} blurred=${header.blurred} kind=${header.kind ?? 'frame'} bytes=${jpeg.length}`,
    );
  };

  const recognize = player || deps.onFrame || !deps.recognizer ? null : createFrameHandler({
    recognizer: deps.recognizer,
    clock: deps.clock,
    log: app.log,
    onSlow: (session) => app.log.warn(`recognition is slow for the session ${session.id}: 3 calls failed in a row`),
    requireBlur: config.requireBlur,
  });
  if (recognize) app.closers.add(() => recognize.stopAll());

  registerSessionRoutes(app, {
    // The test helper sets the address after the server has its port, so the route reads it for each call.
    publicBaseUrl: () => config.publicBaseUrl,
    // A browser client with no phone gets a fake device, and then hears "Camera on".
    onEventsOpen: (session) => player?.start(session, { fakeDevice: !session.connected }),
  });
  registerDeviceSocket(app, {
    onFrame: player ? logFrame : deps.onFrame ?? recognize ?? (() => undefined),
    onOpen: (session) => player?.start(session, { fakeDevice: false }),
  });

  return app;
}
