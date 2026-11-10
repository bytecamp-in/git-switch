import pc from 'picocolors';
import { defaultStore } from '../config.js';
import { defaultCredStore } from '../credentials.js';
import { success, error, warning, info } from '../utils/format.js';
import { getCurrentGitUser } from '../git.js';
import { select } from '@inquirer/prompts';

/**
 * Handles removing an account and its cached credentials.
 *
 * @param {string} [posIdentifier] Positional username or email
 * @param {object} options Parsed CLI options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function removeCommand(
  posIdentifier,
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  let uname = options.uname || options.name;
  let uemail = options.uemail || options.email;

  const accounts = store.listAccounts();

  if (accounts.length === 0) {
    console.log(warning('No accounts saved yet. Nothing to remove.'));
    return;
  }

  // If positional provided and no explicit flag, detect if it's an email or username
  if (!uname && !uemail && posIdentifier) {
    if (posIdentifier.includes('@')) {
      uemail = posIdentifier;
    } else {
      uname = posIdentifier;
    }
  }

  // If still nothing provided and running in interactive TTY, let user pick
  if (!uname && !uemail) {
    if (process.stdin.isTTY) {
      const choice = await select({
        message: 'Select account to remove:',
        choices: accounts.map((acc) => ({
          name: `${acc.username} (${acc.email})`,
          value: acc.username,
        })),
      });
      uname = choice;
    } else {
      console.error(error('Please specify the account to remove.'));
      console.log(`\n${pc.dim('Usage:')}`);
      console.log(`  github remove -uname "username"`);
      console.log(`  github remove -uemail "email"`);
      console.log(`  github remove "username or email"\n`);
      process.exitCode = 1;
      return;
    }
  }

  const removed = store.removeAccount({ username: uname, email: uemail });

  if (!removed) {
    const target = uname ? `username "${uname}"` : `email "${uemail}"`;
    console.error(error(`No account found matching ${target}.`));
    console.log(info(`Run ${pc.cyan('github list')} to see all saved accounts.`));
    process.exitCode = 1;
    return;
  }

  // Also remove from credential store
  credStore.removeCredential(removed.username);
  if (removed.email) {
    credStore.removeCredential(removed.email);
  }

  console.log(
    success(
      `Removed GitHub account: ${pc.bold(removed.username)} <${removed.email}>`
    )
  );

  // Check if removed account matches current global git config
  const currentGit = getCurrentGitUser('global');
  if (
    currentGit.name?.toLowerCase() === removed.username.toLowerCase() ||
    currentGit.email?.toLowerCase() === removed.email.toLowerCase()
  ) {
    console.log(
      warning(
        `Note: The removed account is still active in your global git config.`
      )
    );
    const remaining = store.listAccounts();
    if (remaining.length > 0) {
      console.log(
        pc.dim(
          `Switch to another account using: ${pc.cyan(
            `github switch "${remaining[0].username}"`
          )}`
        )
      );
    }
  }
}
