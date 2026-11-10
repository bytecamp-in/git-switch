import pc from 'picocolors';
import Table from 'cli-table3';
import { defaultStore } from '../config.js';
import {
  readCurrentGitCredential,
  deleteWindowsCredential,
  setWindowsCredential,
  defaultCredStore,
  maskToken,
} from '../credentials.js';
import { success, error, warning, info } from '../utils/format.js';
import { password, input } from '@inquirer/prompts';

/**
 * Handles github cred / credential subcommands:
 *  - status
 *  - save
 *  - restore <username>
 *  - set <username> [token]
 *  - clear
 *
 * @param {'status' | 'save' | 'restore' | 'set' | 'clear'} action
 * @param {string} [param1]
 * @param {string} [param2]
 * @param {object} options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function credCommand(
  action = 'status',
  param1,
  param2,
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  const subAction = (action || 'status').toLowerCase();

  switch (subAction) {
    case 'status': {
      console.log(`\n${pc.bold(pc.cyan('Windows Credential Manager & Cache Status:'))}\n`);

      // Check current active credential in Windows Credential Manager
      const active = readCurrentGitCredential('github.com');
      console.log(pc.bold('Active in Windows Credential Manager:'));
      if (active) {
        console.log(`  Target:   ${pc.cyan('git:https://github.com')}`);
        console.log(`  User:     ${pc.green(active.username)}`);
        console.log(`  Token:    ${pc.dim(maskToken(active.password))}`);
      } else {
        console.log(`  ${pc.dim('(No credentials currently stored for git:https://github.com)')}`);
      }

      console.log(`\n${pc.bold('Cached GitSwitch Credentials:')}`);
      const cached = credStore.listCredentials();
      if (cached.length === 0) {
        console.log(`  ${pc.dim('No credentials cached yet.')}`);
      } else {
        const table = new Table({
          head: [pc.bold('Username'), pc.bold('Email'), pc.bold('Token / Password'), pc.bold('Updated')],
          style: { head: ['cyan'], border: ['gray'] },
        });
        for (const c of cached) {
          table.push([
            pc.green(c.username),
            c.email || pc.dim('-'),
            pc.dim(c.maskedToken),
            pc.dim(new Date(c.updatedAt).toLocaleDateString()),
          ]);
        }
        console.log(table.toString());
      }
      console.log();
      break;
    }

    case 'save': {
      // Reads active credential and saves to cache
      const active = readCurrentGitCredential('github.com');
      if (!active || !active.username || !active.password) {
        console.error(error('No active GitHub credentials found in Windows Credential Manager to save.'));
        process.exitCode = 1;
        return;
      }
      const acc = store.findByUsername(active.username);
      credStore.setCredential(active.username, active.password, acc?.email || '');
      console.log(
        success(
          `Saved credentials for ${pc.bold(active.username)} to GitSwitch cache.`
        )
      );
      break;
    }

    case 'set': {
      let username = param1;
      let token = param2;

      if (!username && process.stdin.isTTY) {
        username = await input({
          message: 'Enter GitHub username for token:',
          validate: (val) => (val.trim() ? true : 'Username cannot be empty.'),
        });
      }

      if (!token && process.stdin.isTTY) {
        token = await password({
          message: `Enter GitHub Personal Access Token (PAT) for ${username}:`,
          mask: '*',
          validate: (val) => (val.trim() ? true : 'Token cannot be empty.'),
        });
      }

      if (!username || !token) {
        console.error(error('Both username and token are required.'));
        console.log(`Usage: github cred set <username> <token>`);
        process.exitCode = 1;
        return;
      }

      const acc = store.findByUsername(username) || store.findByEmail(username);
      credStore.setCredential(acc?.username || username, token, acc?.email || '');
      console.log(
        success(
          `Stored token in GitSwitch cache for ${pc.bold(acc?.username || username)}.`
        )
      );
      break;
    }

    case 'restore': {
      let targetUser = param1;
      if (!targetUser && process.stdin.isTTY) {
        targetUser = await input({
          message: 'Enter username to restore credentials for:',
        });
      }

      if (!targetUser) {
        console.error(error('Please specify a username to restore.'));
        process.exitCode = 1;
        return;
      }

      const cached = credStore.getCredential(targetUser);
      if (!cached) {
        console.error(error(`No cached credentials found for "${targetUser}".`));
        process.exitCode = 1;
        return;
      }

      setWindowsCredential(cached.username, cached.token, 'git:https://github.com');
      console.log(
        success(
          `Restored cached credentials for ${pc.bold(
            cached.username
          )} into Windows Credential Manager.`
        )
      );
      break;
    }

    case 'clear':
    case 'delete': {
      deleteWindowsCredential('git:https://github.com');
      console.log(
        success(
          `Executed: ${pc.cyan(
            'cmdkey /delete:LegacyGeneric:target=git:https://github.com'
          )}`
        )
      );
      console.log(info('Windows Credential Manager entry for GitHub cleared.'));
      break;
    }

    default:
      console.log(`Unknown cred action: "${action}". Available: status, save, set, restore, clear`);
  }
}

