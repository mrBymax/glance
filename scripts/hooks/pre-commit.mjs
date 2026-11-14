// Pre-commit checks of this repository. They look at the staged files only.
//   1. No secret and no secret file enters a commit.
//   2. ESLint passes on the staged JavaScript and TypeScript files.
//   3. ktlint passes on the Android project when a Kotlin file is staged.
// Git runs this file through .githooks/pre-commit. scripts/hooks/install.mjs turns the hooks on.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean);
const problems = [];
const notes = [];

// 1. Secrets.
const SECRET_FILES = [/^\.env$/, /^\.env\..+$/, /\.env$/, /^local\.properties$/, /\.(jks|keystore|p12|pem)$/];
const EXAMPLE_FILE = /\.example$/;
const SECRET_PATTERNS = [
  ['an ElevenLabs API key', /\bsk_[0-9a-f]{32,}\b/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a Google API key', /\bAQ\.[0-9A-Za-z_-]{30,}/],
  ['a database address with a password', /mongodb(\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

for (const file of staged) {
  const name = basename(file);
  if (!EXAMPLE_FILE.test(name) && SECRET_FILES.some((pattern) => pattern.test(name))) {
    problems.push(`${file}: this file can hold a secret. Remove it from the commit with "git restore --staged ${file}".`);
    continue;
  }
  let text;
  try {
    text = git('show', `:${file}`);
  } catch {
    continue; // a file that git cannot print, for example a submodule link
  }
  if (text.length > MAX_SCAN_BYTES || text.includes('\u0000')) continue;
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const hit = SECRET_PATTERNS.find(([, pattern]) => pattern.test(lines[index]));
    if (hit) problems.push(`${file}:${index + 1}: this line looks like ${hit[0]}. Keep secrets in an .env file.`);
  }
}

// 2. ESLint. eslint.config.mjs lists the folders that it skips.
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const scripts = staged.filter((file) => LINTABLE.test(file));
if (scripts.length > 0) {
  const eslint = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!existsSync(join(root, 'package.json'))) {
    notes.push('ESLint skipped: the npm workspace does not exist yet (Plan 0 Task 1 creates it).');
  } else if (!existsSync(eslint)) {
    problems.push('ESLint is not installed. Run "npm install" at the repository root, then commit again.');
  } else {
    for (let start = 0; start < scripts.length; start += 100) {
      const chunk = scripts.slice(start, start + 100);
      const run = spawnSync(process.execPath, [eslint, '--no-warn-ignored', ...chunk], { cwd: root, stdio: 'inherit' });
      if (run.status !== 0) {
        problems.push('ESLint reported errors. Fix them, stage the files, and commit again.');
        break;
      }
    }
  }
}

// 3. ktlint.
const ANDROID = 'apps/mobile/android';
const kotlin = staged.filter((file) => file.startsWith(`${ANDROID}/`) && /\.(kt|kts)$/.test(file));
if (kotlin.length > 0) {
  const windows = process.platform === 'win32';
  const wrapper = join(root, ANDROID, windows ? 'gradlew.bat' : 'gradlew');
  if (!existsSync(wrapper)) {
    notes.push('ktlint skipped: the Gradle wrapper does not exist yet (Plan 2 Task 1 creates it).');
  } else {
    const command = windows ? `"${wrapper}"` : wrapper;
    const run = spawnSync(command, ['ktlintCheck', '--quiet'], { cwd: join(root, ANDROID), stdio: 'inherit', shell: windows });
    if (run.status !== 0) {
      problems.push('ktlint reported errors, or Gradle did not start. Run "gradlew ktlintFormat" in apps/mobile/android. Gradle needs JAVA_HOME.');
    }
  }
}

for (const note of notes) console.error(`pre-commit: ${note}`);
if (problems.length > 0) {
  for (const problem of problems) console.error(`pre-commit: ${problem}`);
  console.error('pre-commit: the commit is stopped.');
  process.exit(1);
}
