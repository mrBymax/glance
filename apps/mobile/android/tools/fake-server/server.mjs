// A stand-in for the Glance server, for work on the Android app. It holds one session and no cart logic.
// Its messages come from packages/shared/fixtures, so each one has the form of the contract.
//
//   node server.mjs        port 8080, or PORT. HOST selects the address, default 0.0.0.0.
//   SAVE_FRAMES=1          writes the newest frame to <temp folder>/glance-last.jpg
//   FIRST_PROMPT_MS=3000   the time from the first frame to the first product prompt
//   keyboard               rest, bio, cancel, amb, slow, badclip, drop
//
// A test on a phone has no keyboard. It runs a command with POST /debug/command/<name>,
// and it reads the newest log lines with GET /debug/log.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, '..', '..', '..', '..', '..', 'packages', 'shared', 'fixtures');
const fixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

const SNAPSHOT = fixture('server-to-device/snapshot.json');
const PENDING = fixture('events/glance.pending.json');
const AMBIGUOUS = fixture('events/glance.ambiguous.json');
const CART_UPDATED = fixture('events/cart.updated.json');
const CHECKOUT_OFFERED = fixture('events/checkout.offered.json');
const CHECKOUT_PAID = fixture('events/checkout.paid.json');
const CHECKOUT_CANCELLED = fixture('events/checkout.cancelled.json');

const SESSION_ID = 's-1';
const TOKEN = 't-1';
const SESSION_PATH = `/api/sessions/${SESSION_ID}`;
const COMMAND_PATH = '/debug/command/';
const COMMANDS = ['rest', 'bio', 'cancel', 'amb', 'slow', 'badclip', 'drop'];
const MAX_KEPT_LOG_LINES = 500;
// The event and the line of the server of Plan 1 after 3 failed recognition calls in a row.
const SLOW = { type: 'error', code: 'recognition.slow', message: 'Recognition is slow right now.' };

const LINES = {
  cameraOn: 'Camera on. Hold a product up to hear its price.',
  cameraOff: 'Camera off.',
  product: 'Oat drink, one litre, one eighty-nine. Nod to add.',
  added: 'Added oat drink. Total four forty-nine.',
  skipped: 'Skipped.',
  pay: 'Checkout 3 at Demo Market. Two items, four euros forty-nine. Nod to pay.',
  paid: 'Paid. Four euros forty-nine. Your receipt is on your phone. Camera off.',
};

// A tone of 1 second: 440 Hz, 16-bit mono, 22050 Hz.
function toneWav() {
  const rate = 22050;
  const data = Buffer.alloc(rate * 2);
  for (let i = 0; i < rate; i += 1) {
    data.writeInt16LE(Math.round(0.3 * 32767 * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // one channel
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); // bytes each second
  header.writeUInt16LE(2, 32); // bytes each sample
  header.writeUInt16LE(16, 34); // bits each sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// The frame layout of Plan 0: a 4-byte header length, the JSON header, the JPEG.
function readFrame(message) {
  if (message.length < 4) return null;
  const headerLength = message.readUInt32BE(0);
  if (headerLength > 1024 || 4 + headerLength > message.length) return null;
  try {
    return { header: JSON.parse(message.toString('utf8', 4, 4 + headerLength)), jpeg: message.subarray(4 + headerLength) };
  } catch {
    return null;
  }
}

/**
 * Starts the fake server. The returned promise gives `{ port, command, close }`.
 * `command(name)` runs one keyboard command, and returns false for a name that is no command.
 * The three delays are options so that a test does not wait.
 */
export function startFakeServer({
  port = 8080,
  host = '0.0.0.0',
  log: print = console.log,
  saveFrames = false,
  firstPromptMs = 3000,
  promptGapMs = 15000,
  dropMs = 10000,
} = {}) {
  const clip = toneWav();
  const sockets = new Set();
  let boundPort = port;
  let refuseUntil = 0;
  let lineCount = 0;
  let promptCount = 0;
  // The open prompt: { id, kind: 'product' or 'pay', at }. A new session starts with none.
  let prompt = null;
  let firstFrameAt = null;
  let lastPromptAt = null;
  let stream = 'stopped';

  const logLines = [];
  const log = (line) => {
    logLines.push(line);
    if (logLines.length > MAX_KEPT_LOG_LINES) logLines.shift();
    print(line);
  };

  const resetSession = () => {
    prompt = null;
    firstFrameAt = null;
    lastPromptAt = null;
    stream = 'stopped';
  };

  const send = (message) => {
    const text = JSON.stringify(message);
    for (const socket of sockets) socket.send(text);
  };
  const event = (body) => send({ t: 'event', event: body });
  const speak = (text, { url = null, sound = null, promptId = null } = {}) => {
    lineCount += 1;
    const id = `c-${String(lineCount).padStart(4, '0')}`;
    send({ t: 'speak', id, priority: 'normal', text, lang: 'en', url, sound, interrupt: false, promptId });
  };
  const newPrompt = (kind) => {
    promptCount += 1;
    prompt = { id: `p-${String(promptCount).padStart(4, '0')}`, kind, at: Date.now() };
    lastPromptAt = prompt.at;
    return prompt.id;
  };
  // The server of Plan 1 ends a product prompt with glance.cleared before a new prompt replaces it.
  const clearProductPrompt = () => {
    if (prompt?.kind === 'product') event({ type: 'glance.cleared', promptId: prompt.id });
    prompt = null;
  };
  const productPrompt = (url) => {
    clearProductPrompt();
    const promptId = newPrompt('product');
    event({ ...PENDING, promptId });
    speak(LINES.product, { url, sound: 'found', promptId });
    log(`prompt ${promptId} product`);
  };
  const payPrompt = () => {
    clearProductPrompt();
    const promptId = newPrompt('pay');
    event({ ...CHECKOUT_OFFERED, promptId });
    speak(LINES.pay, { promptId });
    log(`prompt ${promptId} pay`);
  };

  const onFrame = (message) => {
    const frame = readFrame(message);
    if (frame === null) {
      log(`frame with a bad layout, ${message.length} bytes`);
      return;
    }
    const { seq, w, h, blurred, kind = 'frame' } = frame.header;
    log(`frame seq=${seq} ${w}x${h} blurred=${blurred} kind=${kind} ${frame.jpeg.length} bytes`);
    if (saveFrames) writeFileSync(join(tmpdir(), 'glance-last.jpg'), frame.jpeg);

    const now = Date.now();
    firstFrameAt ??= now;
    const due = lastPromptAt === null ? now - firstFrameAt >= firstPromptMs : now - lastPromptAt >= promptGapMs;
    if (due && prompt?.kind !== 'pay') productPrompt('/clip.wav');
  };

  const onIntent = ({ kind, source, promptId }) => {
    log(`intent ${kind} source=${source} promptId=${promptId ?? 'none'}`);
    if (kind === 'stop') {
      prompt = null;
      speak(LINES.cameraOff);
      send({ t: 'session.end' });
      return;
    }
    if (kind !== 'yes' && kind !== 'no') return;
    if (prompt === null || promptId !== prompt.id) {
      log('rejected');
      return;
    }
    const answered = prompt;
    prompt = null;
    if (kind === 'no') {
      event({ type: 'glance.cleared', promptId: answered.id });
      speak(LINES.skipped);
    } else if (answered.kind === 'pay') {
      event(CHECKOUT_PAID);
      speak(LINES.paid, { sound: 'paid' });
      send({ t: 'session.end' });
    } else {
      event({ type: 'glance.cleared', promptId: answered.id });
      speak(LINES.added, { sound: 'added' });
      event(CART_UPDATED);
    }
  };

  const onText = (text) => {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      log(`text that is not JSON: ${text.slice(0, 80)}`);
      return;
    }
    switch (message.t) {
      case 'device.state': {
        const next = message.state?.stream;
        log(`device.state ${JSON.stringify(message.state)}`);
        if (next === 'streaming' && stream !== 'streaming') speak(LINES.cameraOn, { url: '/clip.wav' });
        if (next === 'stopped' && stream === 'streaming') speak(LINES.cameraOff);
        if (typeof next === 'string') stream = next;
        break;
      }
      case 'intent':
        onIntent(message);
        break;
      case 'kiosk.seen':
        log(`kiosk.seen ${message.text}`);
        // A pay prompt that nobody answered gives way to a new one after the prompt gap.
        if (prompt?.kind !== 'pay' || Date.now() - prompt.at >= promptGapMs) payPrompt();
        break;
      case 'prompt.done':
        log(`prompt.done ${message.promptId}`);
        break;
      case 'biometric.result':
        log(`biometric.result ok=${message.ok}`);
        break;
      default:
        log(text);
    }
  };

  const http = createServer((request, response) => {
    const path = new URL(request.url, 'http://fake').pathname;
    const json = (body) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    log(`${request.method} ${request.url}`);
    request.resume();
    if (request.method === 'POST' && path === '/api/sessions') {
      resetSession();
      json({ sessionId: SESSION_ID, token: TOKEN, wsUrl: `ws://localhost:${boundPort}/ws/device?session=${SESSION_ID}&token=${TOKEN}` });
    } else if (request.method === 'GET' && path === SESSION_PATH) {
      json(SNAPSHOT.session);
    } else if (request.method === 'DELETE' && path === SESSION_PATH) {
      resetSession();
      response.writeHead(204).end();
    } else if (request.method === 'POST' && path.startsWith(COMMAND_PATH)) {
      response.writeHead(command(path.slice(COMMAND_PATH.length)) ? 204 : 404).end();
    } else if (request.method === 'GET' && path === '/debug/log') {
      json(logLines);
    } else if (request.method === 'GET' && path === '/clip.wav') {
      response.writeHead(200, { 'content-type': 'audio/wav', 'content-length': clip.length });
      response.end(clip);
    } else {
      response.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  http.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url, 'http://fake').pathname;
    if (path !== '/ws/device' || Date.now() < refuseUntil) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      sockets.add(ws);
      log('socket open');
      ws.send(JSON.stringify(SNAPSHOT));
      ws.on('message', (data, isBinary) => (isBinary ? onFrame(data) : onText(data.toString('utf8'))));
      ws.on('close', () => {
        sockets.delete(ws);
        log('socket closed');
      });
      ws.on('error', (error) => log(`socket error ${error.message}`));
    });
  });

  const command = (name) => {
    switch (name) {
      case 'rest':
        send({ t: 'session.rest' });
        break;
      case 'bio':
        send({ t: 'biometric.request' });
        break;
      case 'cancel':
        if (prompt?.kind === 'pay') prompt = null;
        event(CHECKOUT_CANCELLED);
        break;
      case 'amb':
        event(AMBIGUOUS);
        break;
      case 'slow':
        event(SLOW);
        speak(SLOW.message);
        break;
      case 'badclip':
        productPrompt('/missing.mp3');
        break;
      case 'drop':
        refuseUntil = Date.now() + dropMs;
        for (const socket of sockets) socket.terminate();
        break;
      default:
        log(`commands: ${COMMANDS.join(', ')}. Not a command: ${name}`);
        return false;
    }
    log(`command ${name}`);
    return true;
  };

  const close = () =>
    new Promise((resolve) => {
      for (const socket of sockets) socket.terminate();
      wss.close();
      http.close(resolve);
      http.closeAllConnections();
    });

  return new Promise((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, () => {
      boundPort = http.address().port;
      log(`fake server on :${boundPort}`);
      resolve({ port: boundPort, command, close });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const server = await startFakeServer({
    port: Number(process.env.PORT ?? 8080),
    host: process.env.HOST ?? '0.0.0.0',
    saveFrames: process.env.SAVE_FRAMES === '1',
    ...(process.env.FIRST_PROMPT_MS ? { firstPromptMs: Number(process.env.FIRST_PROMPT_MS) } : {}),
  });
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (line.trim() !== '') server.command(line.trim());
  });
}
