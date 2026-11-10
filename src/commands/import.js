import pc from 'picocolors';
import { defaultStore } from '../config.js';
import { getCurrentGitUser, isGitInstalled } from '../git.js';
import { success, error, info, warning } from '../utils/format.js';

/**
 * Imports currently active global git credentials into GitSwitch.
 *
 * @param {object} options
 * @param {import('../config.js').ConfigStore} [store]
 */
export async function importCommand(options = {}, store = defaultStore) {
  if (!isGitInstalled()) {
    console.error(error('Git is not installed or not found in system PATH.'));
    process.exitCode = 1;
    return;
  }

  const current = getCurrentGitUser('global');

  if (!current.name || !current.email) {
    console.error(
      error(
        'Global git configuration does not have both user.name and user.email set.'
      )
    );
    console.log(`  user.name:  ${current.name || '(not set)'}`);
    console.log(`  user.email: ${current.email || '(not set)'}`);
    process.exitCode = 1;
    return;
  }

  const existing = store.findByUsername(current.name) || store.findByEmail(current.email);

  if (existing) {
    console.log(
      info(
        `Account already saved in GitSwitch: ${pc.bold(existing.username)} <${
          existing.email
        }>`
      )
    );
    return;
  }

  const { account } = store.addAccount({
    username: current.name,
    email: current.email,
  });

  console.log(
    success(
      `Imported current git user into GitSwitch: ${pc.bold(
        account.username
      )} <${account.email}>`
    )
  );
}

