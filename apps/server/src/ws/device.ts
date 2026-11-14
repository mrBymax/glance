import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';
import { type DeviceToServer, type FrameHeader, type ServerToDevice, decodeFrame, parseDeviceToServer } from '@glance/shared';
import { sessionTopic } from '../bus';
import { tokenMatches } from '../http/auth';
import type { DeviceSink, SessionRuntime } from '../sessions/runtime';
import { parseVoiceCommand } from '../sessions/voice';

/** Gets each frame that decodes. The JPEG is a view on the socket message: the handler copies it if it keeps it. */
export type FrameHandler = (session: SessionRuntime, frame: { header: FrameHeader; jpeg: Uint8Array }) => void;

const DEVICE_PATH = '/ws/device';
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
const PING_EVERY_MS = 20_000;
/** The phone sends 0.5 when the glasses give no value, so 0.5 must pass. */
const MIN_SPEECH_CONFIDENCE = 0.5;
const CLOSE_NORMAL = 1000;
/** How long a refused socket waits for its client to close. */
const REFUSED_CLOSE_MS = 5000;

/**
 * The socket of spec section 8.2, one for each session, at /ws/device?session=<id>&token=<token>.
 * A new socket for a session takes over, and the older one closes.
 * An upgrade with a missing or wrong token gets 401, and one for an unknown session gets 404.
 */
export function registerDeviceSocket(app: FastifyInstance, deps: {
  onFrame: FrameHandler;
  /** Runs when a phone has its snapshot and listens to the events of the session. */
  onOpen: (session: SessionRuntime) => void;
  /** Gets the text of each QR code that the phone reports. */
  onKioskSeen: (session: SessionRuntime, text: string) => void;
}): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  /** Each open socket, with false when it sent no pong since the last ping. */
  const alive = new Map<WebSocket, boolean>();
  /** The sockets that got a refusal and that their client has not closed yet. */
  const refused = new Set<Duplex>();

  /**
   * Answers an upgrade with an HTTP status and lets the client close the connection.
   * If the server closes first, the client can lose the answer: with Node 26 on Windows, a client under load
   * got a connection reset in place of the status for about 15 of 100 refusals.
   */
  const refuse = (socket: Duplex, status: string): void => {
    refused.add(socket);
    const timer = setTimeout(() => socket.destroy(), REFUSED_CLOSE_MS);
    socket.once('close', () => {
      clearTimeout(timer);
      refused.delete(socket);
    });
    socket.once('end', () => socket.destroy());
    socket.resume();
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };

  const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    // Without a listener, an error of the raw socket before the handshake stops the process.
    socket.on('error', () => socket.destroy());
    const url = new URL(request.url ?? '/', 'http://localhost');
    const sessionId = url.pathname === DEVICE_PATH ? url.searchParams.get('session') : null;

    const open = async (): Promise<void> => {
      const session = sessionId === null ? null : await app.sessions.get(sessionId);
      if (!session) {
        refuse(socket, '404 Not Found');
        return;
      }
      // Two token keys are no token, as on the REST paths.
      const tokens = url.searchParams.getAll('token');
      if (tokens.length !== 1 || !tokenMatches(session.token, tokens[0])) {
        refuse(socket, '401 Unauthorized');
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => connect(ws, session));
    };
    open().catch((error) => {
      app.log.error(error);
      socket.destroy();
    });
  };

  const connect = (ws: WebSocket, session: SessionRuntime): void => {
    alive.set(ws, true);
    let unsubscribe: () => void = () => undefined;
    let left = false;

    const send = (message: ServerToDevice): void => ws.send(JSON.stringify(message));
    /** Runs one time, when the socket closes or when another socket takes over. */
    const leave = (): void => {
      if (left) return;
      left = true;
      unsubscribe();
      session.detach(sink);
    };
    const sink: DeviceSink = {
      send,
      close: () => {
        // The events stop now. The close handshake takes time, and the new socket already gets each event.
        leave();
        ws.close(CLOSE_NORMAL);
      },
    };

    session.attach(sink);
    send({ t: 'snapshot', session: session.snapshot() });
    unsubscribe = app.bus.subscribe(sessionTopic(session.id), (event) => send({ t: 'event', event } as ServerToDevice));
    deps.onOpen(session);

    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', (error) => {
      app.log.warn(`device socket of session ${session.id}: ${error.message}`);
      ws.terminate();
    });
    ws.on('close', () => {
      alive.delete(ws);
      leave();
    });
    ws.on('message', (data, isBinary) => {
      if (isBinary) onFrameMessage(session, data);
      else onTextMessage(session, data.toString(), send);
    });
  };

  const onFrameMessage = (session: SessionRuntime, data: RawData): void => {
    // With the default binary type of ws, a message is one Buffer.
    const bytes = data as Buffer;
    let frame: ReturnType<typeof decodeFrame>;
    try {
      frame = decodeFrame(bytes);
    } catch (error) {
      app.log.warn(`device socket of session ${session.id}: dropped a frame. ${(error as Error).message}`);
      return;
    }
    deps.onFrame(session, frame);
  };

  const onTextMessage = (session: SessionRuntime, text: string, send: (message: ServerToDevice) => void): void => {
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // parseDeviceToServer rejects the null below.
    }
    const message = parseDeviceToServer(json);
    if (!message) {
      app.log.warn(`device socket of session ${session.id}: dropped a text message that is no device message`);
      return;
    }
    onDeviceMessage(session, message, send);
  };

  const onDeviceMessage = (session: SessionRuntime, message: DeviceToServer, send: (message: ServerToDevice) => void): void => {
    switch (message.t) {
      case 'intent':
        session.dispatch({
          type: 'intent', kind: message.kind, source: message.source,
          ...(message.promptId === undefined ? {} : { promptId: message.promptId }),
        });
        return;
      case 'prompt.done':
        session.dispatch({ type: 'prompt.done', promptId: message.promptId });
        return;
      case 'device.state':
        session.dispatch({ type: 'device.state', state: message.state });
        return;
      case 'cart.edit':
        session.dispatch({ type: 'cart.edit', productId: message.productId, qty: message.qty });
        return;
      case 'profile.set':
        session.dispatch({ type: 'profile.set', patch: message.patch });
        send({ t: 'snapshot', session: session.snapshot() });
        return;
      case 'speech.final':
        onSpeech(session, message);
        return;
      case 'kiosk.seen':
        deps.onKioskSeen(session, message.text);
        return;
      // No fingerprint check exists yet.
      case 'biometric.result':
        return;
    }
  };

  const onSpeech = (session: SessionRuntime, message: Extract<DeviceToServer, { t: 'speech.final' }>): void => {
    app.log.info(`speech.final text=${JSON.stringify(message.text)} confidence=${message.confidence}`);
    if (message.confidence < MIN_SPEECH_CONFIDENCE) return;
    const command = parseVoiceCommand(message.text);
    if (!command) return;

    const prompt = session.state.prompt;
    // "add" must never pay, and "pay" must never add. With no prompt, "remove" can still take back the last add (R10).
    if (command.only === 'pay' && prompt?.kind !== 'pay') return;
    if (command.only === 'product' && prompt !== null && prompt.kind !== 'product') return;

    // The shopper answers the prompt that was heard to its end.
    const promptId = session.state.lastDone?.promptId;
    session.dispatch({ type: 'intent', kind: command.kind, source: 'voice', ...(promptId === undefined ? {} : { promptId }) });
  };

  const pingTimer = setInterval(() => {
    for (const [ws, answered] of alive) {
      if (!answered) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, PING_EVERY_MS);

  app.server.on('upgrade', onUpgrade);
  app.closers.add(() => {
    clearInterval(pingTimer);
    app.server.off('upgrade', onUpgrade);
    for (const ws of alive.keys()) ws.terminate();
    for (const socket of refused) socket.destroy();
    wss.close();
  });
}
