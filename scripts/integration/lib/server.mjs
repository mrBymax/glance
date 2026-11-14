// Starts the Glance server of apps/server in fake mode, for the integration tests.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const SERVER_DIR = resolve(repoRoot, 'apps/server');
const HOST = '127.0.0.1';
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 200;
const KEPT_LOG_LINES = 5000;

// Each variable that loadConfig of apps/server reads. The child gets none of them from the shell,
// so a key or a database address of the shell cannot reach the server of a test.
const SERVER_VARIABLES = [
  'PORT', 'PUBLIC_BASE_URL', 'MONGODB_URI', 'MONGODB_DB', 'CATALOG_PATH', 'GEMINI_API_KEY', 'GEMINI_MODEL',
  'GEMINI_MEDIA_RESOLUTION', 'RECOGNITION_MIN_CONFIDENCE', 'REQUIRE_BLUR', 'FAKE_RECOGNITION', 'FAKE_SPEECH',
  'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_EN', 'ELEVENLABS_VOICE_IT', 'SPEECH_CACHE_DIR', 'SAVE_FRAMES', 'PAYMENT_DELAY_MS',
];

/** Asks the system for a port that is free now. */
export function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Starts the server with --fake on a free port and waits until GET /healthz answers.
 * `fakeScript` is the path of a FAKE_RECOGNITION script file. Without it the server plays its default script.
 * Returns the address, the log lines so far, and `stop`.
 * Throws when the server does not start, or when one of its two fake switches is off.
 */
export async function startFakeServer({ fakeScript, paymentDelayMs = 300 } = {}) {
  const port = await freePort();
  const env = { ...process.env };
  for (const name of SERVER_VARIABLES) delete env[name];
  env.PORT = String(port);
  env.FAKE_SPEECH = '1';
  env.FAKE_RECOGNITION = fakeScript ?? '1';
  env.PAYMENT_DELAY_MS = String(paymentDelayMs);

  // node runs the server with no npm and no shell between, so `stop` ends the server process itself.
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts', '--fake'], {
    cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  let partial = '';
  const keep = (chunk) => {
    const lines = (partial + chunk).split('\n');
    partial = lines.pop();
    log.push(...lines);
    if (log.length > KEPT_LOG_LINES) log.splice(0, log.length - KEPT_LOG_LINES);
  };
  child.stdout.setEncoding('utf8').on('data', keep);
  child.stderr.setEncoding('utf8').on('data', keep);
  const exited = new Promise((done) => child.once('exit', done));

  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  };

  const url = `http://${HOST}:${port}`;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`The server stopped with the exit code ${child.exitCode}.\n${log.join('\n')}`);
    let health = null;
    try {
      const answer = await fetch(`${url}/healthz`);
      if (answer.ok) health = await answer.json();
    } catch {
      // The server does not listen yet.
    }
    if (health) {
      if (health.fakeRecognition !== true || health.fakeSpeech !== true) {
        await stop();
        throw new Error(`The server is not in fake mode: ${JSON.stringify(health)}. A test must make no vendor call.`);
      }
      return { url, port, log, stop };
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`The server did not answer GET /healthz in ${READY_TIMEOUT_MS} ms.\n${log.join('\n')}`);
    }
    await sleep(READY_POLL_MS);
  }
}
