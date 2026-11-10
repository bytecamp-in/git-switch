import { execFileSync } from 'node:child_process';

/**
 * Checks if git is installed and reachable in PATH.
 * @returns {boolean}
 */
export function isGitInstalled() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if current working directory is inside a git repository.
 * @returns {boolean}
 */
export function isInsideGitRepo() {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Reads a git configuration property.
 *
 * @param {string} key e.g. 'user.name' or 'user.email'
 * @param {'global' | 'local' | 'system'} [scope='global']
 * @returns {string | null}
 */
export function getGitConfig(key, scope = 'global') {
  try {
    const args = ['config'];
    if (scope) {
      args.push(`--${scope}`);
    }
    args.push(key);

    const out = execFileSync('git', args, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return out.trim() || null;
  } catch {
    // git config exits with code 1 if key is not found
    return null;
  }
}

/**
 * Sets a git configuration property.
 *
 * @param {string} key e.g. 'user.name'
 * @param {string} value e.g. 'John Doe'
 * @param {'global' | 'local'} [scope='global']
 */
export function setGitConfig(key, value, scope = 'global') {
  const args = ['config', `--${scope}`, key, value];
  execFileSync('git', args, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

/**
 * Gets currently configured git user for a given scope.
 *
 * @param {'global' | 'local'} [scope='global']
 * @returns {{ name: string | null, email: string | null }}
 */
export function getCurrentGitUser(scope = 'global') {
  return {
    name: getGitConfig('user.name', scope),
    email: getGitConfig('user.email', scope),
  };
}

