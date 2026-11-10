import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_TARGET = 'git:https://github.com';
const LEGACY_TARGET = 'LegacyGeneric:target=git:https://github.com';

/**
 * Reads the currently active Git credential using git credential fill.
 * Works seamlessly with Git Credential Manager, wincred, etc.
 *
 * @param {string} [host='github.com']
 * @returns {{ username: string, password: string } | null}
 */
export function readCurrentGitCredential(host = 'github.com') {
  try {
    const res = spawnSync('git', ['credential', 'fill'], {
      input: `protocol=https\nhost=${host}\n\n`,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    if (res.status !== 0 || !res.stdout) {
      return null;
    }

    const lines = res.stdout.split(/\r?\n/);
    const result = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > -1) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        result[key] = val;
      }
    }

    if (result.username && result.password) {
      return {
        username: result.username,
        password: result.password,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes Windows Credential Manager entries for GitHub.
 * Runs cmdkey /delete:LegacyGeneric:target=git:https://github.com
 * and cmdkey /delete:git:https://github.com
 * Also notifies git credential reject.
 *
 * @param {string} [target=DEFAULT_TARGET]
 * @returns {{ deletedLegacy: boolean, deletedDirect: boolean }}
 */
export function deleteWindowsCredential(target = DEFAULT_TARGET) {
  let deletedLegacy = false;
  let deletedDirect = false;

  if (process.platform === 'win32') {
    // 1. Delete LegacyGeneric:target=...
    try {
      const legacyTarget = `LegacyGeneric:target=${target}`;
      const res = spawnSync('cmdkey', [`/delete:${legacyTarget}`], {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      if (res.status === 0) {
        deletedLegacy = true;
      }
    } catch {
      // Ignore if not found
    }

    // 2. Delete direct target
    try {
      const res = spawnSync('cmdkey', [`/delete:${target}`], {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      if (res.status === 0) {
        deletedDirect = true;
      }
    } catch {
      // Ignore if not found
    }
  }

  // Also notify git credential helper to reject
  try {
    spawnSync('git', ['credential', 'reject'], {
      input: `protocol=https\nhost=github.com\n\n`,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch {
    // Ignore error
  }

  return { deletedLegacy, deletedDirect };
}

/**
 * Sets credentials in Windows Credential Manager using cmdkey and git credential approve.
 *
 * @param {string} username
 * @param {string} password
 * @param {string} [target=DEFAULT_TARGET]
 */
export function setWindowsCredential(username, password, target = DEFAULT_TARGET) {
  if (!username || !password) {
    throw new Error('Both username and password/token are required to store credential.');
  }

  if (process.platform === 'win32') {
    const legacyTarget = `LegacyGeneric:target=${target}`;

    // Add LegacyGeneric target
    try {
      spawnSync(
        'cmdkey',
        [`/generic:${legacyTarget}`, `/user:${username}`, `/pass:${password}`],
        { stdio: 'pipe' }
      );
    } catch {
      // ignore
    }

    // Add direct target
    try {
      spawnSync(
        'cmdkey',
        [`/generic:${target}`, `/user:${username}`, `/pass:${password}`],
        { stdio: 'pipe' }
      );
    } catch {
      // ignore
    }
  }

  // Also approve via git credential helper so Git Credential Manager picks it up
  try {
    spawnSync('git', ['credential', 'approve'], {
      input: `protocol=https\nhost=github.com\nusername=${username}\npassword=${password}\n\n`,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch {
    // ignore
  }
}

/**
 * Manages secure persistent storage for account credentials/tokens.
 */
export class CredentialStore {
  /**
   * @param {string} [customPath]
   */
  constructor(customPath) {
    this.customPath = customPath;
  }

  getFilePath() {
    if (this.customPath) {
      return this.customPath;
    }
    if (process.env.GITSWITCH_CRED_PATH) {
      return process.env.GITSWITCH_CRED_PATH;
    }
    return path.join(os.homedir(), '.gitswitch', 'credentials.json');
  }

  load() {
    const file = this.getFilePath();
    if (!fs.existsSync(file)) {
      return { version: '1.0.0', credentials: {} };
    }
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.credentials || typeof parsed.credentials !== 'object') {
        parsed.credentials = {};
      }
      return parsed;
    } catch {
      return { version: '1.0.0', credentials: {} };
    }
  }

  save(data) {
    const file = this.getFilePath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const tempFile = `${file}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    fs.renameSync(tempFile, file);
  }

  /**
   * Saves or updates a credential for a user.
   *
   * @param {string} username
   * @param {string} token
   * @param {string} [email]
   */
  setCredential(username, token, email = '') {
    if (!username || !token) return;
    const data = this.load();
    const key = username.toLowerCase();
    data.credentials[key] = {
      username,
      token,
      email: email || data.credentials[key]?.email || '',
      updatedAt: new Date().toISOString(),
    };
    this.save(data);
  }

  /**
   * Retrieves a cached credential by username or email.
   *
   * @param {string} identifier Username or email
   * @returns {{ username: string, token: string, email?: string, updatedAt: string } | null}
   */
  getCredential(identifier) {
    if (!identifier) return null;
    const lower = identifier.toLowerCase().trim();
    const data = this.load();

    // 1. Direct username key match
    if (data.credentials[lower]) {
      return data.credentials[lower];
    }

    // 2. Search by username or email inside entries
    for (const item of Object.values(data.credentials)) {
      if (
        item.username?.toLowerCase() === lower ||
        item.email?.toLowerCase() === lower
      ) {
        return item;
      }
    }

    return null;
  }

  /**
   * Removes a cached credential.
   * @param {string} identifier Username or email
   * @returns {boolean}
   */
  removeCredential(identifier) {
    if (!identifier) return false;
    const lower = identifier.toLowerCase().trim();
    const data = this.load();

    let foundKey = null;
    if (data.credentials[lower]) {
      foundKey = lower;
    } else {
      for (const [key, item] of Object.entries(data.credentials)) {
        if (
          item.username?.toLowerCase() === lower ||
          item.email?.toLowerCase() === lower
        ) {
          foundKey = key;
          break;
        }
      }
    }

    if (foundKey) {
      delete data.credentials[foundKey];
      this.save(data);
      return true;
    }
    return false;
  }

  /**
   * Lists all cached credentials (masking tokens).
   */
  listCredentials() {
    const data = this.load();
    return Object.values(data.credentials).map((item) => ({
      username: item.username,
      email: item.email || '',
      maskedToken: maskToken(item.token),
      updatedAt: item.updatedAt,
    }));
  }
}

export function maskToken(token) {
  if (!token) return 'none';
  if (token.length <= 8) return '********';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export const defaultCredStore = new CredentialStore();

