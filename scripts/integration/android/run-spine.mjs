// Integration test 3: the Android app with mock glasses on the test phone, against the fake server.
//
// It starts apps/server with fake recognition and fake speech on port 8080, lets the phone reach it through
// "adb reverse", builds and installs the debug APK and its test APK, runs the instrumented tests, and then
// removes the reverse and stops the server. No step calls a vendor.
//
// Use, in scripts/integration:
//   node android/run-spine.mjs                 the spine test, one time
//   node android/run-spine.mjs --runs 3        the spine test, three times, each with a new server
//   node android/run-spine.mjs --all           each instrumented test class
//   node android/run-spine.mjs --class com.metaglance.android.ProbeLinkTest
//   node android/run-spine.mjs --no-build      use the APK files of the last build
//
// The tools must be on PATH: load %USERPROFILE%\.glance-tools\env.sh or env.ps1 first.
// Exit status: 0 = each run passed, 1 = a failure, 2 = the phone is locked or not attached.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClips } from './make-clips.mjs';

/** The one phone of the tests. A second phone can be attached, and it must never get a command. */
const SERIAL = 'P11262000912';
const PORT = 8080;
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const APP_ID = 'com.metaglance.android';
const TEST_RUNNER = `${APP_ID}.test/androidx.test.runner.AndroidJUnitRunner`;
const SPINE_CLASS = `${APP_ID}.SpineTest`;
const MEDIA_STREAM = '3';
const SERVER_START_MS = 30_000;
const TEST_TIMEOUT_MS = 10 * 60_000;
const BUILD_TIMEOUT_MS = 20 * 60_000;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const serverDir = join(root, 'apps/server');
const androidDir = join(root, 'apps/mobile/android');
const scriptFile = join(here, 'spine-script.json');
const logDir = join(tmpdir(), 'glance-integration');

class Blocked extends Error {}

function parseArgs(argv) {
  const options = { runs: 1, testClass: SPINE_CLASS, build: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs') options.runs = Number(argv[(i += 1)]);
    else if (arg === '--class') options.testClass = argv[(i += 1)];
    else if (arg === '--all') options.testClass = null;
    else if (arg === '--no-build') options.build = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs takes a number from 1.');
  return options;
}

/** Runs adb for the test phone only. Returns the output. Throws when adb fails, unless `allowFailure` is set. */
function adb(args, { allowFailure = false, timeout = 120_000 } = {}) {
  const run = spawnSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', timeout });
  if (run.error) throw new Error(`adb did not run: ${run.error.message}`);
  const output = `${run.stdout}${run.stderr}`;
  if (run.status !== 0 && !allowFailure) throw new Error(`adb ${args.join(' ')} failed with status ${run.status}:\n${output}`);
  return output;
}

function checkPhone() {
  const state = adb(['get-state'], { allowFailure: true }).trim();
  if (state !== 'device') throw new Blocked(`The phone ${SERIAL} is not attached (adb state: ${state || 'none'}).`);
  if (/isKeyguardShowing=true/.test(adb(['shell', 'dumpsys', 'window']))) {
    throw new Blocked(`The phone ${SERIAL} is locked. Unlock it, then run this script again.`);
  }
}

/** The tests must make no sound, and with the volume 0 the app reports each prompt at once. */
function muteMedia() {
  const output = adb(['shell', 'cmd', 'media_session', 'volume', '--stream', MEDIA_STREAM, '--get']);
  const volume = /volume is (\d+)/.exec(output)?.[1];
  if (volume === undefined) throw new Error(`The media volume of the phone is not readable:\n${output}`);
  if (volume === '0') {
    console.log('phone: media volume is 0');
    return;
  }
  console.log(`phone: media volume was ${volume}, set to 0. Restore: adb -s ${SERIAL} shell cmd media_session volume --stream ${MEDIA_STREAM} --set ${volume}`);
  adb(['shell', 'cmd', 'media_session', 'volume', '--stream', MEDIA_STREAM, '--set', '0']);
}

function portIsFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once('error', () => done(false));
    probe.once('listening', () => probe.close(() => done(true)));
    probe.listen(port, '0.0.0.0');
  });
}

async function health() {
  try {
    const response = await fetch(`${SERVER_URL}/healthz`, { signal: AbortSignal.timeout(2000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** Starts the server with both fake switches. It gets no vendor key, so it cannot call a vendor. */
async function startServer(logFile) {
  if (!(await portIsFree(PORT))) throw new Error(`Port ${PORT} is in use. Stop the process that holds it.`);
  const env = { ...process.env, PORT: String(PORT), FAKE_RECOGNITION: scriptFile, FAKE_SPEECH: '1' };
  for (const name of ['GEMINI_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_EN', 'ELEVENLABS_VOICE_IT', 'MONGODB_URI', 'SAVE_FRAMES']) delete env[name];
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: serverDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = createWriteStream(logFile);
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });

  const end = Date.now() + SERVER_START_MS;
  while (Date.now() < end) {
    if (exited) throw new Error(`The server stopped at its start. Log: ${logFile}\n${readFileSync(logFile, 'utf8')}`);
    const answer = await health();
    if (answer) {
      if (answer.fakeRecognition !== true || answer.fakeSpeech !== true) {
        await stopServer(child);
        throw new Error(`The server on port ${PORT} does not run with both fake switches: ${JSON.stringify(answer)}`);
      }
      return child;
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  await stopServer(child);
  throw new Error(`The server did not answer in ${SERVER_START_MS} ms. Log: ${logFile}`);
}

function stopServer(child) {
  return new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      done();
      return;
    }
    child.once('exit', () => done());
    child.kill();
  });
}

function build() {
  // cmd.exe does not find a bare file name in the working directory when the shell was started from Git Bash.
  const gradlew = process.platform === 'win32' ? `"${join(androidDir, 'gradlew.bat')}"` : './gradlew';
  const args = [':app:assembleDebug', ':app:assembleDebugAndroidTest', `-Pglance.serverUrl=${SERVER_URL}`, '--console=plain', '-q'];
  // With more than one phone attached, Gradle uses each phone unless this variable names one.
  const env = { ...process.env, ANDROID_SERIAL: SERIAL };
  // A .bat file needs the shell on Windows. The command is one text, and each part of it is a constant of this file.
  const run = process.platform === 'win32'
    ? spawnSync([gradlew, ...args].join(' '), { cwd: androidDir, env, stdio: 'inherit', shell: true, timeout: BUILD_TIMEOUT_MS })
    : spawnSync(gradlew, args, { cwd: androidDir, env, stdio: 'inherit', timeout: BUILD_TIMEOUT_MS });
  if (run.error) throw new Error(`Gradle did not run: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`The Gradle build failed with status ${run.status}.`);
}

function install() {
  const apks = [
    join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk'),
    join(androidDir, 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'),
  ];
  for (const apk of apks) {
    if (!existsSync(apk)) throw new Error(`No APK at ${apk}. Run without --no-build.`);
    // No "-g": the app must not hold BLUETOOTH_CONNECT, so that it never starts the real SDK on this phone.
    const output = adb(['install', '-r', '-t', apk], { timeout: 5 * 60_000 });
    if (!/Success/.test(output)) throw new Error(`adb install failed for ${apk}:\n${output}`);
  }
}

/** Returns true when each test passed. The runner prints "OK (n tests)" only then. */
function runTests(testClass) {
  const target = testClass === null ? [] : ['-e', 'class', testClass];
  const output = adb(['shell', 'am', 'instrument', '-w', ...target, TEST_RUNNER], { allowFailure: true, timeout: TEST_TIMEOUT_MS });
  console.log(output.trim());
  return /^OK \(\d+ tests?\)/m.test(output) && !/FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed/.test(output);
}

function count(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

/** The view of the server: what arrived from the phone. */
function serverSawSpine(logFile) {
  const log = readFileSync(logFile, 'utf8');
  const frames = count(log, /frame seq=\d+/g);
  console.log(`server: ${frames} frames arrived. Log: ${logFile}`);
  return frames >= 2;
}

async function runOnce(options, index) {
  const logFile = join(logDir, `server-${Date.now()}-${index}.log`);
  const server = await startServer(logFile);
  let passed;
  try {
    adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
    passed = runTests(options.testClass);
  } finally {
    adb(['reverse', '--remove', `tcp:${PORT}`], { allowFailure: true });
    await stopServer(server);
  }
  // The log file is complete only after the server stopped.
  if (passed && options.testClass === SPINE_CLASS) passed = serverSawSpine(logFile);
  return passed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(logDir, { recursive: true });
  checkPhone();
  muteMedia();
  await makeClips();
  if (options.build) build();
  install();

  let failures = 0;
  for (let index = 1; index <= options.runs; index += 1) {
    console.log(`run ${index} of ${options.runs}: ${options.testClass ?? 'each test class'}`);
    // The phone can lock between two runs.
    checkPhone();
    const passed = await runOnce(options, index);
    console.log(`run ${index}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) failures += 1;
  }
  console.log(failures === 0 ? `PASS: ${options.runs} of ${options.runs} runs` : `FAIL: ${failures} of ${options.runs} runs failed`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (status) => process.exit(status),
  (error) => {
    console.error(error.message);
    process.exit(error instanceof Blocked ? 2 : 1);
  },
);
