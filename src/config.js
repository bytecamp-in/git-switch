import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class ConfigStore {
  /**
   * @param {string} [customPath]
   */
  constructor(customPath) {
    this.customPath = customPath;
  }

  /**
   * Gets the path to the config file.
   * Priority: customPath -> GITSWITCH_CONFIG_PATH -> ~/.gitswitch/config.json
   * @returns {string}
   */
  getConfigPath() {
    if (this.customPath) {
      return this.customPath;
    }
    if (process.env.GITSWITCH_CONFIG_PATH) {
      return process.env.GITSWITCH_CONFIG_PATH;
    }
    return path.join(os.homedir(), '.gitswitch', 'config.json');
  }

  /**
   * Loads config from disk. Returns default empty config if file doesn't exist.
   * @returns {{ version: string, accounts: Array<{ username: string, email: string, sshKey?: string, createdAt: string, lastUsed?: string }> }}
   */
  load() {
    const configPath = this.getConfigPath();
    if (!fs.existsSync(configPath)) {
      return {
        version: '1.0.0',
        accounts: [],
      };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.accounts)) {
        parsed.accounts = [];
      }
      return parsed;
    } catch {
      return {
        version: '1.0.0',
        accounts: [],
      };
    }
  }

  /**
   * Writes config to disk.
   * @param {object} data
   */
  save(data) {
    const configPath = this.getConfigPath();
    const dir = path.dirname(configPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const jsonString = JSON.stringify(data, null, 2);
    // Write atomically using a temporary file
    const tempPath = `${configPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, configPath);
  }

  /**
   * Returns list of all saved accounts.
   */
  listAccounts() {
    const config = this.load();
    return config.accounts;
  }

  /**
   * Finds an account by username or email (case-insensitive).
   * @param {string} identifier
   */
  findAccount(identifier) {
    if (!identifier) return null;
    const lower = identifier.trim().toLowerCase();
    const accounts = this.listAccounts();
    return (
      accounts.find(
        (acc) =>
          acc.username.toLowerCase() === lower ||
          acc.email.toLowerCase() === lower
      ) || null
    );
  }

  /**
   * Finds an account strictly by username.
   * @param {string} username
   */
  findByUsername(username) {
    if (!username) return null;
    const lower = username.trim().toLowerCase();
    return (
      this.listAccounts().find((acc) => acc.username.toLowerCase() === lower) ||
      null
    );
  }

  /**
   * Finds an account strictly by email.
   * @param {string} email
   */
  findByEmail(email) {
    if (!email) return null;
    const lower = email.trim().toLowerCase();
    return (
      this.listAccounts().find((acc) => acc.email.toLowerCase() === lower) ||
      null
    );
  }

  /**
   * Adds or updates an account.
   * @param {{ username: string, email: string, sshKey?: string, overwrite?: boolean }} param0
   * @returns {{ account: object, isNew: boolean }}
   */
  addAccount({ username, email, sshKey = '', overwrite = true }) {
    const cleanUser = username?.trim();
    const cleanEmail = email?.trim();

    if (!cleanUser) {
      throw new Error('Username is required.');
    }
    if (!cleanEmail) {
      throw new Error('Email is required.');
    }

    const config = this.load();
    const existingIndex = config.accounts.findIndex(
      (acc) =>
        acc.username.toLowerCase() === cleanUser.toLowerCase() ||
        acc.email.toLowerCase() === cleanEmail.toLowerCase()
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      if (!overwrite) {
        throw new Error(
          `Account with username "${cleanUser}" or email "${cleanEmail}" already exists.`
        );
      }
      const existing = config.accounts[existingIndex];
      config.accounts[existingIndex] = {
        ...existing,
        username: cleanUser,
        email: cleanEmail,
        sshKey: sshKey || existing.sshKey || '',
        updatedAt: now,
      };
      this.save(config);
      return { account: config.accounts[existingIndex], isNew: false };
    }

    const newAccount = {
      username: cleanUser,
      email: cleanEmail,
      sshKey: sshKey || '',
      createdAt: now,
    };

    config.accounts.push(newAccount);
    this.save(config);
    return { account: newAccount, isNew: true };
  }

  /**
   * Removes an account by username or email.
   * @param {{ username?: string, email?: string }} criteria
   * @returns {object | null} The removed account, or null if not found.
   */
  removeAccount({ username, email }) {
    const config = this.load();
    const initialLength = config.accounts.length;

    let targetIndex = -1;

    if (username) {
      const lowerUser = username.trim().toLowerCase();
      targetIndex = config.accounts.findIndex(
        (acc) => acc.username.toLowerCase() === lowerUser
      );
    } else if (email) {
      const lowerEmail = email.trim().toLowerCase();
      targetIndex = config.accounts.findIndex(
        (acc) => acc.email.toLowerCase() === lowerEmail
      );
    }

    if (targetIndex === -1) {
      return null;
    }

    const [removed] = config.accounts.splice(targetIndex, 1);
    this.save(config);
    return removed;
  }

  /**
   * Updates the last-used timestamp for an account.
   * @param {string} username
   */
  markUsed(username) {
    const config = this.load();
    const account = config.accounts.find(
      (acc) => acc.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (account) {
      account.lastUsed = new Date().toISOString();
      this.save(config);
    }
  }
}

export const defaultStore = new ConfigStore();

