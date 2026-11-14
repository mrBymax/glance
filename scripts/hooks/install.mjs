// Points git at the tracked hooks folder. "npm install" runs this file through the prepare script.
// It does nothing where git or the repository is missing, for example in the Docker build.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
} catch {
  // No git checkout here. The hooks are not needed.
}
