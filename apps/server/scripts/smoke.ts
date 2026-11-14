// Plays a phone and a web client against a running server: npm run smoke -- <baseUrl>
// It checks the REST paths, the device socket, and the events stream, also through a proxy.
// The server needs no fake switch for it. With real speech, the "Camera on" line is one ElevenLabs call if its clip does not exist yet.
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { CreateSessionResponseSchema } from '@glance/shared';

export type SmokeResult = { ok: boolean; steps: { name: string; ok: boolean; detail?: string }[] };

const START_LINE = 'Camera on. Hold a product up to hear its price.';
const STEP_TIMEOUT_MS = 5000;

const STREAMING_GLASSES = {
  t: 'device.state',
  state: { link: 'connected', battery: 80, worn: true, hingeOpen: true, thermal: 0, stream: 'streaming' },
};

type Json = Record<string, unknown>;

function limit<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const late = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not arrive in ${STEP_TIMEOUT_MS} ms`)), STEP_TIMEOUT_MS);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** fetch reports a connection that fails as "fetch failed", and the cause holds the reason. */
function reason(error: unknown): string {
  const { message, cause } = error as { message?: string; cause?: { message?: string; code?: string } };
  return cause?.message || cause?.code || message || String(error);
}

/** The JSON text messages of a socket. `next` also finds a message that came before the call. */
function socketMessages(ws: WebSocket): { next(match: (message: Json) => boolean, what: string): Promise<Json> } {
  const messages: Json[] = [];
  let waiting: { match: (message: Json) => boolean; resolve: (message: Json) => void }[] = [];
  let failure: Error | null = null;
  let fail: (error: Error) => void = () => undefined;
  const failed = new Promise<never>((_resolve, reject) => { fail = reject; });
  // A step that does not wait for a message must not see this rejection as an unhandled one.
  failed.catch(() => undefined);
  const stop = (error: Error): void => {
    failure ??= error;
    fail(failure);
  };

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    const message = JSON.parse(data.toString()) as Json;
    messages.push(message);
    const found = waiting.filter((entry) => entry.match(message));
    waiting = waiting.filter((entry) => !found.includes(entry));
    for (const entry of found) entry.resolve(message);
  });
  ws.on('error', (error) => stop(error));
  ws.on('unexpected-response', (_request, response) => stop(new Error(`the socket upgrade answered ${response.statusCode}`)));
  ws.on('close', (code) => stop(new Error(`the socket closed with the code ${code}`)));

  return {
    next: (match, what) => {
      const found = messages.find(match);
      if (found) return Promise.resolve(found);
      return limit(Promise.race([new Promise<Json>((resolve) => waiting.push({ match, resolve })), failed]), what);
    },
  };
}

/** Reads `data:` messages of an events stream until one matches. */
async function nextEvent(reader: ReadableStreamDefaultReader<Uint8Array>, match: (event: Json) => boolean): Promise<Json> {
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const end = buffer.indexOf('\n\n');
    if (end < 0) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('the events stream ended');
      buffer += decoder.decode(chunk.value, { stream: true });
      continue;
    }
    const data = buffer.slice(0, end).split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart());
    buffer = buffer.slice(end + 2);
    if (data.length === 0) continue;
    const event = JSON.parse(data.join('\n')) as Json;
    if (match(event)) return event;
  }
}

/** Runs the seven steps and stops at the first one that fails. It deletes the session that it made. */
export async function runSmoke(baseUrl: string): Promise<SmokeResult> {
  const base = baseUrl.replace(/\/+$/, '');
  const call = (method: string, path: string): Promise<Response> =>
    fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(STEP_TIMEOUT_MS) });
  const expectStatus = (response: Response, status: number): void => {
    if (response.status !== status) throw new Error(`status ${response.status}, expected ${status}`);
  };

  let session: { sessionId: string; token: string; wsUrl: string } | null = null;
  let ws: WebSocket | null = null;
  let phone: ReturnType<typeof socketMessages> | null = null;
  const stream = new AbortController();
  let events: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const sessionPath = (suffix = ''): string => `/api/sessions/${session!.sessionId}${suffix}?token=${session!.token}`;

  const plan: [name: string, run: () => Promise<void>][] = [
    ['health', async () => expectStatus(await call('GET', '/healthz'), 200)],
    ['session', async () => {
      const response = await call('POST', '/api/sessions');
      expectStatus(response, 201);
      session = CreateSessionResponseSchema.parse(await response.json());
    }],
    // The socket opens before the events stream. With fake recognition, the events path of a session
    // with no socket starts a fake device, and the line step would then get no "Camera on" line.
    ['socket', async () => {
      ws = new WebSocket(session!.wsUrl);
      phone = socketMessages(ws);
      await phone.next((message) => message.t === 'snapshot', `a snapshot from ${session!.wsUrl.replace(/\?.*$/, '')}`);
    }],
    ['events', async () => {
      const response = await fetch(`${base}${sessionPath('/events')}`, { signal: stream.signal });
      expectStatus(response, 200);
      events = response.body!.getReader();
    }],
    ['line', async () => {
      ws!.send(JSON.stringify(STREAMING_GLASSES));
      await phone!.next((message) => message.t === 'speak' && message.text === START_LINE, 'the speak message of the start line');
    }],
    ['caption', async () => {
      await limit(nextEvent(events!, (event) => event.type === 'caption' && event.text === START_LINE), 'the caption of the start line');
    }],
    ['delete', async () => {
      expectStatus(await call('DELETE', sessionPath()), 204);
      session = null;
    }],
  ];

  const steps: SmokeResult['steps'] = [];
  try {
    for (const [name, run] of plan) {
      try {
        await run();
        steps.push({ name, ok: true });
      } catch (error) {
        steps.push({ name, ok: false, detail: reason(error) });
        break;
      }
    }
  } finally {
    stream.abort();
    (ws as WebSocket | null)?.terminate();
    // A session that stays would be the newest live session of the mirror page.
    if (session) await call('DELETE', sessionPath()).catch(() => undefined);
  }
  return { ok: steps.length === plan.length && steps.every((step) => step.ok), steps };
}

async function main(): Promise<void> {
  const baseUrl = process.argv[2];
  if (baseUrl === undefined) {
    console.error('smoke: give the address of the server, for example http://127.0.0.1:8080');
    process.exitCode = 1;
    return;
  }
  const result = await runSmoke(baseUrl);
  for (const step of result.steps) console.log(step.ok ? `ok ${step.name}` : `FAIL ${step.name}: ${step.detail}`);
  console.log(result.ok ? 'smoke: OK' : 'smoke: FAIL');
  if (!result.ok) process.exitCode = 1;
}

// A test imports this file for runSmoke. Only the command runs main.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
