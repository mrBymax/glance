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
  'SECOND_LOOK_WAIT_MS', 'DEMO_KEY', 'STORE_LIST_PATH', 'FAKE_PRODUCT_INFO', 'OFF_BASE_URL', 'PRODUCT_INFO_USER_AGENT', 'PRODUCT_CACHE_DIR',
  'LABEL_MIN_CONFIDENCE', 'REFERENCE_DIR',
];

/**
 * The environment of the server of a test: the shell environment with no server variable, and then the three fake switches.
 * So the server reads the dev catalog and the dev store list, and it calls no vendor and no Open Food Facts.
 */
export function fakeServerEnv(shell, { port, fakeScript, paymentDelayMs, demoKey }) {
  const env = { ...shell };
  for (const name of SERVER_VARIABLES) delete env[name];
  env.PORT = String(port);
  env.FAKE_SPEECH = '1';
  env.FAKE_RECOGNITION = fakeScript ?? '1';
  env.FAKE_PRODUCT_INFO = '1';
  env.PAYMENT_DELAY_MS = String(paymentDelayMs);
  if (demoKey !== null) env.DEMO_KEY = demoKey;
  return env;
}

/** `health` is the answer of GET /healthz. A server that reports no switch for the product details counts as real. */
export function inFakeMode(health) {
  return health.fakeRecognition === true && health.fakeSpeech === true && health.fakeProductInfo === true;
}

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
 * `demoKey` is the key of GET /api/demo/latest. Without it that path answers 404.
 * Returns the address, the demo key, the log lines so far, and `stop`.
 * Throws when the server does not start, or when one of its three fake switches is off.
 */
export async function startFakeServer({ fakeScript, paymentDelayMs = 300, demoKey = null } = {}) {
  const port = await freePort();
  const env = fakeServerEnv(process.env, { port, fakeScript: fakeScript ?? null, paymentDelayMs, demoKey });

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
      if (!inFakeMode(health)) {
        await stop();
        throw new Error(`The server is not in fake mode: ${JSON.stringify(health)}. A test must call no vendor and no Open Food Facts.`);
      }
      return { url, port, demoKey, log, stop };
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`The server did not answer GET /healthz in ${READY_TIMEOUT_MS} ms.\n${log.join('\n')}`);
    }
    await sleep(READY_POLL_MS);
  }
}
