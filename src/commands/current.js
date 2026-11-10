import pc from 'picocolors';
import { defaultStore } from '../config.js';
import { defaultCredStore, readCurrentGitCredential, maskToken } from '../credentials.js';
import { getCurrentGitUser, isInsideGitRepo, isGitInstalled } from '../git.js';
import { info, warning } from '../utils/format.js';

/**
 * Displays current active git account configuration and Windows Credential Manager status.
 *
 * @param {object} options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function currentCommand(
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  if (!isGitInstalled()) {
    console.error(pc.red('Git is not installed or not found in system PATH.'));
    process.exitCode = 1;
    return;
  }

  const globalUser = getCurrentGitUser('global');
  const inRepo = isInsideGitRepo();
  const localUser = inRepo ? getCurrentGitUser('local') : null;

  console.log(`\n${pc.bold(pc.cyan('Git Configuration Status:'))}\n`);

  // Global Config Display
  console.log(`${pc.bold('Global Git User:')}`);
  if (globalUser.name || globalUser.email) {
    console.log(`  Name:  ${globalUser.name ? pc.green(globalUser.name) : pc.dim('(unset)')}`);
    console.log(`  Email: ${globalUser.email ? pc.green(globalUser.email) : pc.dim('(unset)')}`);
  } else {
    console.log(`  ${pc.dim('No global git user.name or user.email configured.')}`);
  }

  // Local Config Display (if inside git repo)
  if (inRepo) {
    console.log(`\n${pc.bold('Local Repository Git User:')}`);
    if (localUser?.name || localUser?.email) {
      console.log(`  Name:  ${localUser.name ? pc.green(localUser.name) : pc.dim('(unset)')}`);
      console.log(`  Email: ${localUser.email ? pc.green(localUser.email) : pc.dim('(unset)')}`);
    } else {
      console.log(`  ${pc.dim('No local repo override (inheriting global git config).')}`);
    }
  }

  // Determine active effective user
  const effectiveName = (inRepo && localUser?.name) || globalUser.name;
  const effectiveEmail = (inRepo && localUser?.email) || globalUser.email;

  // Match against GitSwitch stored accounts
  console.log(`\n${pc.bold('GitSwitch Profile Match:')}`);
  if (effectiveName || effectiveEmail) {
    const matched =
      store.findByUsername(effectiveName || '') ||
      store.findByEmail(effectiveEmail || '') ||
      store.findAccount(effectiveName || effectiveEmail || '');

    if (matched) {
      console.log(`  ${pc.green('●')} Account:   ${pc.bold(matched.username)}`);
      console.log(`    Email:     ${matched.email}`);
      const cached =
        credStore.getCredential(matched.username) ||
        credStore.getCredential(matched.email);
      console.log(
        `    Token:     ${cached ? pc.green(`Cached (${cached.token.slice(0, 4)}...)`) : pc.dim('not cached')}`
      );
      if (matched.sshKey) {
        console.log(`    SSH Key:   ${pc.cyan(matched.sshKey)}`);
      }
      console.log(`    Added:     ${pc.dim(new Date(matched.createdAt).toLocaleDateString())}`);
    } else {
      console.log(`  ${warning('Current active git user is not registered in GitSwitch.')}`);
      console.log(
        `  ${pc.dim('Save it quickly with:')} ${pc.cyan(
          `github add -uname "${effectiveName || 'username'}" -uemail "${effectiveEmail || 'email'}"`
        )}`
      );
    }
  } else {
    console.log(`  ${pc.dim('No git user configured.')}`);
  }

  // Windows Credential Manager Active Status
  console.log(`\n${pc.bold('Windows Credential Manager (git:https://github.com):')}`);
  const activeCred = readCurrentGitCredential('github.com');
  if (activeCred) {
    console.log(`  Active User:  ${pc.green(activeCred.username)}`);
    console.log(`  Token Status: ${pc.green('Present')} (${pc.dim(maskToken(activeCred.password))})`);
  } else {
    console.log(`  ${pc.dim('No credential currently loaded in Windows Credential Manager.')}`);
  }

  console.log();
}
