// Integration test 3: the Android app with mock glasses on the test phone, against the fake server.
//
// It starts apps/server with fake recognition and fake speech on port 8080, lets the phone reach it through
// "adb reverse", builds the phone UI, builds and installs the debug APK and its test APK, runs the instrumented
// tests, and then removes the reverse and stops the server. No step calls a vendor.
//
// The three tests of the brief are three suites:
//   spine  SpineTest: one shop from the first frame to the payment
//   state  DeviceStatesTest and SetupFlowTest: each device and error state
//   page   PhoneUiPageTest: the phone UI in the WebView
//
// Use, in scripts/integration:
//   node android/run-spine.mjs                 the spine suite, one time
//   node android/run-spine.mjs --integration   the three suites, each with a new server
//   node android/run-spine.mjs --suite state   one suite. A list takes commas: --suite state,page
//   node android/run-spine.mjs --runs 3        each selected suite three times, each time with a new server
//   node android/run-spine.mjs --all           each instrumented test class
//   node android/run-spine.mjs --class com.metaglance.android.ProbeLinkTest
//   node android/run-spine.mjs --no-build      use the APK files of the last build
//
// The tools must be on PATH: load %USERPROFILE%\.glance-tools\env.sh or env.ps1 first.
// Exit status: 0 = each test passed, 1 = a failure, 2 = the phone is locked or not attached,
// 3 = no failure, but a test was skipped.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeClips, makeKioskClip } from './make-clips.mjs';

/** The one phone of the tests. A second phone can be attached, and it must never get a command. */
const SERIAL = 'P11262000912';
const PORT = 8080;
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const APP_ID = 'com.metaglance.android';
const TEST_RUNNER = `${APP_ID}.test/${APP_ID}.support.GlanceTestRunner`;
const SPINE_CLASS = `${APP_ID}.SpineTest`;
const STATES_CLASS = `${APP_ID}.DeviceStatesTest`;
const SUITES = {
  spine: [SPINE_CLASS],
  state: [STATES_CLASS, `${APP_ID}.SetupFlowTest`],
  page: [`${APP_ID}.PhoneUiPageTest`],
};
/** The clip of the kiosk that declines each payment, in the cache folder of the app. */
const FAIL_KIOSK_CLIP = 'kiosk-fail.mp4';
const MEDIA_STREAM = '3';
const SERVER_START_MS = 30_000;
const TEST_TIMEOUT_MS = 10 * 60_000;
const BUILD_TIMEOUT_MS = 20 * 60_000;

/** The status codes of "am instrument -r" for one test. */
const TEST_STARTED = 1;
const TEST_PASSED = 0;
const TEST_IGNORED = -3;
const TEST_ASSUMPTION_FAILED = -4;

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const serverDir = join(root, 'apps/server');
const androidDir = join(root, 'apps/mobile/android');
const scriptFile = join(here, 'spine-script.json');
const logDir = join(tmpdir(), 'glance-integration');

class Blocked extends Error {}

function parseArgs(argv) {
  const options = { runs: 1, targets: [{ name: 'spine', classes: SUITES.spine }], build: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--runs') options.runs = Number(argv[(i += 1)]);
    else if (arg === '--class') options.targets = [{ name: argv[(i += 1)], classes: [argv[i]] }];
    else if (arg === '--suite') options.targets = suiteTargets(String(argv[(i += 1)]).split(','));
    else if (arg === '--integration') options.targets = suiteTargets(Object.keys(SUITES));
    else if (arg === '--all') options.targets = [{ name: 'each test class', classes: null }];
    else if (arg === '--no-build') options.build = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs takes a number from 1.');
  if (options.targets.some((target) => target.classes?.includes(undefined))) throw new Error('--class takes a class name.');
  return options;
}

function suiteTargets(names) {
  return names.map((name) => {
    if (!Object.hasOwn(SUITES, name)) throw new Error(`Unknown suite: ${name}. The suites: ${Object.keys(SUITES).join(', ')}.`);
    return { name: `suite ${name}`, classes: SUITES[name] };
  });
}

/** Runs adb for the test phone only. Returns the output. Throws when adb fails, unless `allowFailure` is set. */
function adb(args, { allowFailure = false, timeout = 120_000, input } = {}) {
  const run = spawnSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', timeout, input, maxBuffer: 64 * 1024 * 1024 });
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

/** Runs one command line through the shell. Each part of `command` is a constant of this file. */
function runShell(what, command, cwd, env) {
  const run = spawnSync(command, { cwd, env, stdio: 'inherit', shell: true, timeout: BUILD_TIMEOUT_MS });
  if (run.error) throw new Error(`${what} did not run: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`${what} failed with status ${run.status}.`);
}

function build() {
  // Gradle copies apps/mobile/ui/dist into the APK, and it does not run npm. So the phone UI is built first.
  runShell('The build of the phone UI', 'npm run build --workspace @glance/phone-ui', root, process.env);
  // cmd.exe does not find a bare file name in the working directory when the shell was started from Git Bash.
  const gradlew = process.platform === 'win32' ? `"${join(androidDir, 'gradlew.bat')}"` : './gradlew';
  const args = [':app:assembleDebug', ':app:assembleDebugAndroidTest', `-Pglance.serverUrl=${SERVER_URL}`, '--console=plain', '-q'];
  // With more than one phone attached, Gradle uses each phone unless this variable names one.
  runShell('The Gradle build', [gradlew, ...args].join(' '), androidDir, { ...process.env, ANDROID_SERIAL: SERIAL });
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

/**
 * Registers a kiosk that declines each payment, and puts a clip with its code into the cache folder of the app.
 * The server gives each kiosk a random code, so the clip is new for each server. Returns the QR text of the code.
 */
async function addFailKiosk() {
  const response = await fetch(`${SERVER_URL}/api/kiosks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Checkout 9', store: 'Demo Market', failPayment: true }),
    signal: AbortSignal.timeout(5000),
  });
  if (response.status !== 201) throw new Error(`POST /api/kiosks gave the status ${response.status}.`);
  const text = `GL1 ${(await response.json()).code}`;
  const clip = join(logDir, FAIL_KIOSK_CLIP);
  await makeKioskClip(text, clip);
  try {
    // "run-as" writes as the app, so the file needs no storage permission and no folder outside the app.
    adb(['exec-in', `run-as ${APP_ID} sh -c 'mkdir -p cache && cat > cache/${FAIL_KIOSK_CLIP}'`], { input: readFileSync(clip) });
  } finally {
    rmSync(clip, { force: true });
  }
  return text;
}

/**
 * Reads the output of "am instrument -r". Returns one entry for each test that ended, with its status code and
 * the first line of its stack trace.
 */
function readTests(output) {
  const tests = [];
  let fields = {};
  for (const line of output.split(/\r?\n/)) {
    const field = /^INSTRUMENTATION_STATUS: (\w+)=(.*)$/.exec(line);
    const code = /^INSTRUMENTATION_STATUS_CODE: (-?\d+)$/.exec(line);
    if (field) {
      fields[field[1]] = field[2];
    } else if (code) {
      const status = Number(code[1]);
      if (status !== TEST_STARTED) tests.push({ name: `${fields.class}#${fields.test}`, status, cause: fields.stack ?? '' });
      fields = {};
    }
  }
  return tests;
}

/** Runs the tests. Returns `passed`, and the tests that did not run because a condition of theirs did not hold. */
function runTests(classes, failKioskText) {
  const target = classes === null ? [] : ['-e', 'class', classes.join(',')];
  const kiosk = failKioskText === null ? [] : ['-e', 'failKioskText', `'${failKioskText}'`, '-e', 'failKioskClip', FAIL_KIOSK_CLIP];
  const output = adb(['shell', 'am', 'instrument', '-w', '-r', ...target, ...kiosk, TEST_RUNNER], { allowFailure: true, timeout: TEST_TIMEOUT_MS });
  const tests = readTests(output);
  const skipped = tests.filter((test) => test.status === TEST_IGNORED || test.status === TEST_ASSUMPTION_FAILED);
  for (const test of tests) {
    const word = test.status === TEST_PASSED ? 'ok  ' : skipped.includes(test) ? 'skip' : 'FAIL';
    console.log(`${word} ${test.name}${skipped.includes(test) && test.cause ? `: ${test.cause}` : ''}`);
  }
  // The summary of the runner, with the stack trace of each failure. It has "OK (n tests)" only when each test passed.
  const summary = output.slice(Math.max(0, output.indexOf('INSTRUMENTATION_RESULT:')));
  console.log(summary.trim());
  const passed = /^OK \(\d+ tests?\)/m.test(summary) && !/FAILURES!!!|INSTRUMENTATION_FAILED|Process crashed/.test(output);
  return { passed, skipped: skipped.map((test) => test.name) };
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

async function runOnce(target, index) {
  const logFile = join(logDir, `server-${Date.now()}-${index}.log`);
  const server = await startServer(logFile);
  let result;
  try {
    adb(['reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
    const needsFailKiosk = target.classes === null || target.classes.some((name) => name.startsWith(STATES_CLASS));
    result = runTests(target.classes, needsFailKiosk ? await addFailKiosk() : null);
  } finally {
    adb(['reverse', '--remove', `tcp:${PORT}`], { allowFailure: true });
    adb(['shell', `run-as ${APP_ID} rm -f cache/${FAIL_KIOSK_CLIP}`], { allowFailure: true });
    await stopServer(server);
  }
  // The log file is complete only after the server stopped.
  if (result.passed && target.classes?.includes(SPINE_CLASS)) result.passed = serverSawSpine(logFile);
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(logDir, { recursive: true });
  checkPhone();
  muteMedia();
  await makeClips();
  if (options.build) build();
  install();

  const total = options.runs * options.targets.length;
  const skipped = new Set();
  let failures = 0;
  let index = 0;
  for (let run = 1; run <= options.runs; run += 1) {
    for (const target of options.targets) {
      index += 1;
      console.log(`run ${index} of ${total}: ${target.name}`);
      // The phone can lock between two runs.
      checkPhone();
      const result = await runOnce(target, index);
      console.log(`run ${index}: ${result.passed ? 'PASS' : 'FAIL'}`);
      if (!result.passed) failures += 1;
      for (const name of result.skipped) skipped.add(name);
    }
  }
  if (failures > 0) {
    console.log(`FAIL: ${failures} of ${total} runs failed`);
    return 1;
  }
  if (skipped.size > 0) {
    console.log(`PASS with skipped tests: ${total} of ${total} runs. Skipped: ${[...skipped].join(', ')}`);
    return 3;
  }
  console.log(`PASS: ${total} of ${total} runs`);
  return 0;
}

main().then(
  (status) => process.exit(status),
  (error) => {
    console.error(error.message);
    process.exit(error instanceof Blocked ? 2 : 1);
  },
);
