import pc from 'picocolors';
import { defaultStore } from '../config.js';
import {
  setGitConfig,
  getCurrentGitUser,
  isInsideGitRepo,
  isGitInstalled,
} from '../git.js';
import {
  readCurrentGitCredential,
  deleteWindowsCredential,
  setWindowsCredential,
  defaultCredStore,
} from '../credentials.js';
import { success, error, warning, info } from '../utils/format.js';
import { select } from '@inquirer/prompts';

/**
 * Handles switching git accounts and managing Windows Credential Manager cache.
 *
 * @param {string} [posTarget] Username or email to switch to
 * @param {object} options Parsed CLI options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function switchCommand(
  posTarget,
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  if (!isGitInstalled()) {
    console.error(error('Git is not installed or not found in system PATH.'));
    process.exitCode = 1;
    return;
  }

  const accounts = store.listAccounts();
  if (accounts.length === 0) {
    console.log(warning('No GitHub accounts registered in GitSwitch.'));
    console.log(
      `\nAdd an account first with:\n  ${pc.cyan(
        'github add -uname "username" -uemail "email@example.com"'
      )}\n`
    );
    process.exitCode = 1;
    return;
  }

  let target =
    options.uname ||
    options.name ||
    options.uemail ||
    options.email ||
    posTarget;
  const isLocal = Boolean(options.local);
  const scope = isLocal ? 'local' : 'global';

  if (isLocal && !isInsideGitRepo()) {
    console.error(
      error(
        'Cannot use --local: Current directory is not inside a git repository.'
      )
    );
    process.exitCode = 1;
    return;
  }

  // Interactive selection if target not provided
  if (!target) {
    if (process.stdin.isTTY) {
      const currentGit = getCurrentGitUser(scope);
      const choice = await select({
        message: `Select GitHub account to switch to (${scope}):`,
        choices: accounts.map((acc) => {
          const isActive =
            currentGit.name?.toLowerCase() === acc.username.toLowerCase() ||
            currentGit.email?.toLowerCase() === acc.email.toLowerCase();
          return {
            name: `${acc.username} (${acc.email})${
              isActive ? pc.green(' [current]') : ''
            }`,
            value: acc.username,
          };
        }),
      });
      target = choice;
    } else {
      console.error(error('Please specify the account to switch to.'));
      console.log(`\n${pc.dim('Usage:')}`);
      console.log(`  github switch "username"`);
      console.log(`  github switch "email@example.com"`);
      console.log(`  github switch "username" --local\n`);
      console.log(`${pc.dim('Available accounts:')}`);
      accounts.forEach((acc) =>
        console.log(`  - ${pc.bold(acc.username)} (${acc.email})`)
      );
      console.log();
      process.exitCode = 1;
      return;
    }
  }

  // Look for account by username or email
  const account =
    store.findAccount(target) ||
    store.findByUsername(target) ||
    store.findByEmail(target);

  if (!account) {
    console.error(error(`Account "${target}" not found in GitSwitch.`));
    console.log(`\n${pc.dim('Available accounts:')}`);
    accounts.forEach((acc) =>
      console.log(`  - ${pc.bold(acc.username)} (${acc.email})`)
    );
    console.log(
      `\n${pc.dim('To add this account, run:')}\n  ${pc.cyan(
        `github add -uname "${target}" -uemail "your-email@example.com"`
      )}\n`
    );
    process.exitCode = 1;
    return;
  }

  try {
    const skipCred = options.noCred === true;

    // 1. SAVE CURRENT ACTIVE CREDENTIAL BEFORE SWITCHING
    if (!skipCred) {
      const currentCred = readCurrentGitCredential('github.com');
      if (currentCred && currentCred.username && currentCred.password) {
        // Save current credential to cache
        credStore.setCredential(
          currentCred.username,
          currentCred.password,
          account.username.toLowerCase() === currentCred.username.toLowerCase()
            ? account.email
            : ''
        );
        console.log(
          info(`Cached active credential for ${pc.bold(currentCred.username)}`)
        );
      }

      // 2. DELETE ACTIVE CREDENTIAL FROM WINDOWS CREDENTIAL MANAGER
      // Runs cmdkey /delete:LegacyGeneric:target=git:https://github.com
      deleteWindowsCredential('git:https://github.com');
      console.log(
        info(
          `Cleared Windows Credential Manager: ${pc.dim(
            'cmdkey /delete:LegacyGeneric:target=git:https://github.com'
          )}`
        )
      );
    }

    // 3. SET GIT CONFIG
    setGitConfig('user.name', account.username, scope);
    setGitConfig('user.email', account.email, scope);

    if (account.sshKey && options.ssh) {
      setGitConfig('core.sshCommand', `ssh -i "${account.sshKey}"`, scope);
    }

    store.markUsed(account.username);

    console.log(
      success(
        `Switched to GitHub account: ${pc.bold(pc.green(account.username))} <${
          account.email
        }> [${pc.cyan(scope)}]`
      )
    );

    // 4. RESTORE TARGET ACCOUNT CREDENTIAL FROM CACHE (IF AVAILABLE)
    if (!skipCred) {
      const targetCred =
        credStore.getCredential(account.username) ||
        credStore.getCredential(account.email);

      if (targetCred && targetCred.token) {
        setWindowsCredential(
          targetCred.username || account.username,
          targetCred.token,
          'git:https://github.com'
        );
        console.log(
          success(
            `Restored cached credentials for ${pc.bold(
              targetCred.username || account.username
            )} into Windows Credential Manager`
          )
        );
      } else {
        console.log(
          info(
            `No cached credentials for ${pc.bold(
              account.username
            )}. On your next git push/pull, Windows/Git will prompt for authentication and GitSwitch will automatically cache it for future switches.`
          )
        );
      }
    }

    if (account.sshKey) {
      console.log(info(`Associated SSH Key: ${pc.cyan(account.sshKey)}`));
    }
  } catch (err) {
    console.error(error(`Failed to update git config: ${err.message}`));
    process.exitCode = 1;
  }
}
