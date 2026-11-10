import pc from 'picocolors';
import { defaultStore } from '../config.js';
import { defaultCredStore } from '../credentials.js';
import { success, error, info } from '../utils/format.js';
import { setGitConfig, getCurrentGitUser } from '../git.js';
import { input } from '@inquirer/prompts';

/**
 * Handles adding an account.
 *
 * @param {string} [posName] Positional username
 * @param {string} [posEmail] Positional email
 * @param {object} options Parsed CLI options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function addCommand(
  posName,
  posEmail,
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  let username = options.uname || options.name || posName;
  let email = options.uemail || options.email || posEmail;
  const sshKey = options.ssh || '';
  const token = options.token || options.pat || options.pass || '';

  // If interactive terminal and fields are missing, prompt the user
  if (!username && process.stdin.isTTY) {
    username = await input({
      message: 'Enter GitHub / Git username:',
      validate: (val) => (val.trim() ? true : 'Username cannot be empty.'),
    });
  }

  if (!email && process.stdin.isTTY) {
    email = await input({
      message: 'Enter Git email address:',
      validate: (val) => {
        if (!val.trim()) return 'Email cannot be empty.';
        if (!val.includes('@')) return 'Please enter a valid email address.';
        return true;
      },
    });
  }

  if (!username || !email) {
    console.error(error('Both username and email are required.'));
    console.log(`\n${pc.dim('Usage:')}`);
    console.log(`  github add -uname "username" -uemail "email"`);
    console.log(`  github add "username" "email"\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const { account, isNew } = store.addAccount({
      username,
      email,
      sshKey,
      overwrite: true,
    });

    if (token) {
      credStore.setCredential(account.username, token, account.email);
    }

    if (isNew) {
      console.log(
        success(
          `Added GitHub account: ${pc.bold(account.username)} <${account.email}>`
        )
      );
    } else {
      console.log(
        success(
          `Updated GitHub account: ${pc.bold(account.username)} <${account.email}>`
        )
      );
    }

    if (token) {
      console.log(
        info(`Saved GitHub access token/credential for ${pc.bold(account.username)}`)
      );
    }

    // If options.switch is set or if this is the only account and git has no config, suggest or switch
    const allAccounts = store.listAccounts();
    const currentGit = getCurrentGitUser('global');

    if (options.switch) {
      setGitConfig('user.name', account.username, 'global');
      setGitConfig('user.email', account.email, 'global');
      store.markUsed(account.username);
      console.log(
        info(
          `Switched global git user to ${pc.bold(account.username)} <${
            account.email
          }>`
        )
      );
    } else if (allAccounts.length === 1 && (!currentGit.name || !currentGit.email)) {
      setGitConfig('user.name', account.username, 'global');
      setGitConfig('user.email', account.email, 'global');
      store.markUsed(account.username);
      console.log(
        info(
          `Automatically activated ${pc.bold(
            account.username
          )} as your global git user.`
        )
      );
    } else {
      console.log(pc.dim(`\nTo switch to this account, run:`));
      console.log(pc.cyan(`  github switch "${account.username}"\n`));
    }
  } catch (err) {
    console.error(error(err.message));
    process.exitCode = 1;
  }
}
