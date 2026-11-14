// Integration test 1: the Glance server and the Kotlin client of the Android app.
// Starts the server in fake mode, runs the Gradle task :core:integrationTest against it, and stops the server.
// Use: node scripts/integration/server-kotlin.mjs
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, startFakeServer } from './lib/server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = resolve(repoRoot, 'apps/mobile/android');
// ServerSpineTest sends this number of frames with this size.
const FRAME_COUNT = 3;
const FRAME_SIZE = 'w=432 h=768';
const LOG_TAIL_LINES = 40;
const LOG_SETTLE_MS = 300;

function runGradle(serverUrl) {
  const windows = process.platform === 'win32';
  const wrapper = resolve(ANDROID_DIR, windows ? 'gradlew.bat' : 'gradlew');
  const args = [':core:integrationTest', `-Pglance.serverUrl=${serverUrl}`, '--console=plain'];
  console.log(`test: gradlew ${args.join(' ')}`);
  // Node starts a .bat file only through cmd.exe. The command is one text, with quotes for a path with a space.
  const child = windows
    ? spawn(`"${wrapper}" ${args.join(' ')}`, { cwd: ANDROID_DIR, stdio: 'inherit', shell: true })
    : spawn(wrapper, args, { cwd: ANDROID_DIR, stdio: 'inherit' });
  return new Promise((done, fail) => {
    child.once('error', fail);
    child.once('exit', done);
  });
}

/** In fake mode the server logs the header of each frame that decodes. Returns the problems. */
function checkFrames(log) {
  const problems = [];
  for (let seq = 1; seq <= FRAME_COUNT; seq += 1) {
    if (!log.some((line) => line.includes(`frame seq=${seq} ${FRAME_SIZE} blurred=true kind=frame`))) {
      problems.push(`The server did not log the frame ${seq} with ${FRAME_SIZE}.`);
    }
  }
  return problems;
}

async function main() {
  if (!process.env.JAVA_HOME) {
    console.error('JAVA_HOME is not set. Gradle needs a JDK from 17 to 24.');
    return 1;
  }
  const server = await startFakeServer({ fakeScript: resolve(here, 'server-kotlin.fake-script.json') });
  console.log(`server: fake mode on ${server.url}`);
  try {
    const code = await runGradle(server.url);
    // The server writes the log line of a frame after the socket message arrived, so the last line can be late.
    await new Promise((done) => setTimeout(done, LOG_SETTLE_MS));
    const problems = code === 0 ? checkFrames(server.log) : [`Gradle ended with the exit code ${code}.`];
    if (problems.length === 0) {
      console.log('result: pass');
      return 0;
    }
    for (const problem of problems) console.error(problem);
    console.error(`The last ${LOG_TAIL_LINES} log lines of the server:`);
    console.error(server.log.slice(-LOG_TAIL_LINES).join('\n'));
    console.error('result: fail');
    return 1;
  } finally {
    await server.stop();
    console.log('server: stopped');
  }
}

main().then((code) => process.exit(code), (error) => {
  console.error(error);
  process.exit(1);
});
