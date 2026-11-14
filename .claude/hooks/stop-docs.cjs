// Stop hook of Claude Code for this repository. .claude/settings.json runs it each time Claude wants to stop.
// When code changed and no documentation changed with it, the hook asks Claude one time to update the documentation.
// Input: JSON on stdin. Answer: {"decision":"block","reason":"..."} on stdout keeps Claude at work. No output lets it stop.
// The hook never stops Claude two times in a row, and each failure of the hook itself lets Claude stop.
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { isAbsolute, join } = require('node:path');

const CODE = /^(apps|packages|infra|scripts|agents)\//;
const NOT_CODE = [/\.md$/, /(^|\/)package-lock\.json$/, /\.test\.[a-z]+$/, /\/src\/(test|androidTest)\//, /\/fixtures\//, /\/testdata\//];
const DOCS = [/(^|\/)README\.md$/, /^docs\/(?!overnight\/|superpowers\/|research\/)/];

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    // No input, or input that is not JSON. Go on with the defaults.
  }

  const start = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: start, encoding: 'utf8' }).trim();
  // trimEnd, not trim: a status line can start with a space.
  const git = (...args) => execFileSync('git', args, { cwd: top, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
  const tryGit = (...args) => {
    try {
      return git(...args);
    } catch {
      return null;
    }
  };

  // The state lives in the git folder, so git never tracks it. One entry for each working tree.
  const common = git('rev-parse', '--git-common-dir');
  const stateFile = join(isAbsolute(common) ? common : join(top, common), 'glance-stop-docs.json');
  let state = {};
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    // First run.
  }
  const seen = state[top] || {};

  const head = tryGit('rev-parse', 'HEAD');
  if (!head) return;
  const status = git('status', '--porcelain', '--untracked-files=all');
  const fingerprint = createHash('sha256').update(`${head}\n${status}`).digest('hex');
  const save = (entry) => {
    state[top] = entry;
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  };
  const remember = () => save({ commit: head, fingerprint });

  // Claude already works on a request of this hook. Let it stop, and start the next check from here.
  if (input.stop_hook_active === true) return remember();
  if (seen.fingerprint === fingerprint) return;
  // The hook asked for these exact files before, and nothing changed since. Do not ask a second time.
  if (seen.asked === fingerprint) return remember();

  let base = seen.commit && tryGit('merge-base', '--is-ancestor', seen.commit, head) !== null ? seen.commit : null;
  if (!base) base = tryGit('merge-base', head, 'origin/main');
  const committed = base ? git('diff', '--name-only', base, head).split('\n') : [];
  const pending = status.split('\n').filter(Boolean).map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
  const changed = [...new Set([...committed, ...pending])].filter(Boolean);

  const code = changed.filter((file) => CODE.test(file) && !NOT_CODE.some((pattern) => pattern.test(file)));
  const docs = changed.filter((file) => DOCS.some((pattern) => pattern.test(file)));
  if (code.length === 0 || docs.length > 0) return remember();

  const areas = new Map();
  for (const file of code) {
    const parts = file.split('/');
    const area = parts[0] === 'apps' && parts[1] === 'mobile' ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
    areas.set(area, (areas.get(area) || 0) + 1);
  }
  const list = [...areas].map(([area, count]) => `${area} (${count} ${count === 1 ? 'file' : 'files'})`).join(', ');

  const reason = [
    'Documentation check of this repository (.claude/hooks/stop-docs.cjs).',
    `Code changed, and no documentation changed with it: ${list}.`,
    'Before you stop, update each document that these changes make wrong or incomplete:',
    '- README.md at the root: what the project is, the folders, and the commands that install, test, and run each part.',
    '- The README.md of each changed app or package: how to run it, its settings, and its checks.',
    '- docs/architecture.md: the parts, the messages between them, and the states. Write each diagram as a Mermaid code block.',
    'Describe only what exists and works now. Follow skills/anti-slop/SKILL.md.',
    'If no document needs a change, say so in one line and stop.',
  ].join('\n');
  save({ ...seen, asked: fingerprint });
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

try {
  main();
} catch {
  // A broken check must never keep Claude at work.
}
