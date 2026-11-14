import Fastify, { type FastifyInstance } from 'fastify';
import { type Lang, formatKioskCode } from '@glance/shared';
import { EventBus } from './bus';
import type { CatalogIndex } from './catalog/catalog';
import type { Clock } from './clock';
import type { Config } from './config';
import type { Store } from './db/store';
import { pathOnly } from './http/auth';
import { registerDemoRoutes } from './http/demo';
import { registerKioskRoutes } from './http/kiosks';
import { registerSessionRoutes } from './http/sessions';
import { registerSpeechRoutes } from './http/speech';
import { KioskService } from './kiosk/kiosks';
import { createPayments } from './kiosk/payment';
import { ScriptPlayer, readFakeScript } from './recognition/fake';
import type { Recognizer } from './recognition/gemini';
import { createFrameHandler, saveFrameWith } from './recognition/intake';
import type { FrameSaver } from './recognition/save';
import { SessionRegistry } from './sessions/registry';
import type { RuntimeDeps } from './sessions/runtime';
import { ClipCache } from './speech/clips';
import type { Synthesize } from './speech/elevenlabs';
import { createClipUrl } from './speech/service';
import { type FrameHandler, frameLogLine, registerDeviceSocket } from './ws/device';

export type AppDeps = {
  config: Config; clock: Clock; store: Store; catalog: CatalogIndex;
  /** false gives no log. An object sends each log line to its stream. */
  log?: boolean | { level: string; stream: { write(line: string): void } };
  /** Names the product of each frame. Fake recognition does not use it. */
  recognizer?: Recognizer;
  /** Makes the speech clips. Without it, and with FAKE_SPEECH, each line goes out with no clip. */
  synthesize?: Synthesize;
  /** Answers a spoken question about a product. Fake recognition does not use it. */
  ask?: RuntimeDeps['ask'];
  /** Gets each frame of each phone, in place of the recognizer. With neither, the server drops the frames. */
  onFrame?: FrameHandler;
  /** Writes each frame to disk. Only main.ts makes one, and only with SAVE_FRAMES. Without it the server stores no frame. */
  saveFrame?: FrameSaver;
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
    clips: ClipCache;
    kiosks: KioskService;
  }
}

/** The kiosk that the fake server has from its start. A printed "GL1 K3X7" code then starts a checkout. */
const FAKE_KIOSK = { name: 'Checkout 3', store: 'Demo Market', code: 'K3X7' };

/** With fake recognition no model answers a question, so each question gets this line. */
const FAKE_ANSWER: Record<Lang, string> = { en: 'I do not have that information.', it: 'Non ho questa informazione.' };

/** The body of a request with the JSON content type and a text that is no JSON. */
const NOT_JSON = Symbol('not JSON');

const ERROR_NAMES: Record<number, string> = { 400: 'bad_request', 401: 'unauthorized', 404: 'not_found' };

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  // A script that the server cannot use stops the start, before a timer or a socket exists.
  const fakeScript = config.fakeRecognition === null ? null : readFakeScript(config.fakeRecognition, deps.catalog);
  const log = deps.log ?? true;
  const app = Fastify({
    logger: log === false ? false : {
      ...(log === true ? {} : log),
      // The query string holds the token or the demo key, so the request log gets the method and the path only.
      serializers: { req: (request: { method: string; url: string }) => ({ method: request.method, url: pathOnly(request.url) }) },
    },
  });

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
      // No error here: an error would answer 400 before the handler checks the token.
      // This value fails each body schema, so the handler answers 400 after its token check.
      done(null, NOT_JSON);
    }
  });

  // A body that is no JSON gets 400 on an unknown path too, as before the parser gave it to the handlers.
  app.setNotFoundHandler((request, reply) => (request.body === NOT_JSON
    ? reply.code(400).send({ error: 'bad_request' })
    : reply.code(404).send({ error: 'not_found' })));
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

  const saveFrame = deps.saveFrame ?? null;
  const bus = new EventBus();
  const clips = new ClipCache(config.speechCacheDir, deps.store);
  const kiosks = new KioskService({ store: deps.store, bus, clock: deps.clock });
  const payments = createPayments({ store: deps.store, clock: deps.clock, kiosks, delayMs: config.paymentDelayMs });
  let ask: RuntimeDeps['ask'];
  if (fakeScript !== null) ask = async (_question, _product, lang) => FAKE_ANSWER[lang];
  else ask = deps.ask ?? (async () => { throw new Error('The server has no answer service.'); });
  const sessions = new SessionRegistry({
    clock: deps.clock,
    catalog: deps.catalog,
    store: deps.store,
    bus,
    clipUrl: createClipUrl({
      fake: config.fakeSpeech,
      cache: clips,
      synthesize: deps.synthesize ?? null,
      voiceId: config.voiceId,
      // The test helper sets the address after the server has its port, so each call reads it.
      publicBaseUrl: () => config.publicBaseUrl,
      log: (line) => app.log.warn(line),
    }),
    startPayment: payments,
    ask,
    afterStep: (session, before) => kiosks.sync(session, before),
  });
  app.decorate('bus', bus);
  app.decorate('sessions', sessions);
  app.decorate('clips', clips);
  app.decorate('kiosks', kiosks);
  sessions.startTicks();
  app.closers.add(() => {
    sessions.stop();
    payments.cancelAll();
    kiosks.stop();
  });

  app.get('/healthz', async () => ({
    ok: true,
    fakeRecognition: config.fakeRecognition !== null,
    fakeSpeech: config.fakeSpeech,
    store: config.mongodbUri === null ? 'memory' : 'mongo',
    // The team checks this before the demo: the server must store no frame then.
    saveFrames: saveFrame !== null,
  }));

  // With fake recognition, one script player stands for the frames and the recognition calls of each session.
  const player = fakeScript === null ? null : new ScriptPlayer({
    script: fakeScript,
    clock: deps.clock,
    onKiosk: (session, which) => {
      const kiosk = which === 'newest' ? kiosks.newest() : kiosks.byCode(which);
      if (kiosk) kiosks.sight(session, formatKioskCode(kiosk.code));
    },
  });
  if (player) app.closers.add(() => player.stopAll());
  // Fake recognition drops each frame after this line. With SAVE_FRAMES it saves the frame first,
  // so the team can collect frames for the test set with no recognition call.
  const logFrame: FrameHandler = (session, { header, jpeg }) => {
    app.log.info(frameLogLine(header, jpeg.length));
    // As with real recognition, REQUIRE_BLUR keeps a frame with no face detection off the disk.
    if (config.requireBlur && !header.blurred) return;
    // The JPEG is a view on the socket message, and the write ends later, so the saver gets a copy.
    if (saveFrame) saveFrameWith(saveFrame, app.log, session.id, { header, jpeg: new Uint8Array(jpeg) });
  };

  const recognize = player || deps.onFrame || !deps.recognizer ? null : createFrameHandler({
    recognizer: deps.recognizer,
    clock: deps.clock,
    log: app.log,
    onSlow: (session) => {
      app.log.warn(`recognition is slow for the session ${session.id}: 3 calls failed in a row`);
      session.dispatch({ type: 'recognition.slow' });
    },
    requireBlur: config.requireBlur,
    saveFrame,
  });
  if (recognize) app.closers.add(() => recognize.stopAll());

  registerSessionRoutes(app, {
    publicBaseUrl: () => config.publicBaseUrl,
    // A browser client with no phone gets a fake device, and then hears "Camera on".
    onEventsOpen: (session) => player?.start(session, { fakeDevice: !session.connected }),
    onDelete: (sessionId) => kiosks.release(sessionId),
  });
  registerKioskRoutes(app, { kiosks });
  registerSpeechRoutes(app, { cache: clips, fake: config.fakeSpeech });
  registerDemoRoutes(app, { demoKey: config.demoKey });
  registerDeviceSocket(app, {
    onFrame: player ? logFrame : deps.onFrame ?? recognize ?? (() => undefined),
    onOpen: (session) => player?.start(session, { fakeDevice: false }),
    onKioskSeen: (session, text) => kiosks.sight(session, text),
  });

  await kiosks.load();
  // A store that outlives the process already has the kiosk after the first start.
  if (player && !kiosks.byCode(FAKE_KIOSK.code)) {
    await kiosks.register({ name: FAKE_KIOSK.name, store: FAKE_KIOSK.store }, FAKE_KIOSK.code);
  }

  return app;
}
