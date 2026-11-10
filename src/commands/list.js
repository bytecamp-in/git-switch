import Table from 'cli-table3';
import pc from 'picocolors';
import { defaultStore } from '../config.js';
import { defaultCredStore } from '../credentials.js';
import { getCurrentGitUser, isInsideGitRepo } from '../git.js';
import { info } from '../utils/format.js';

/**
 * Lists all registered GitHub accounts.
 *
 * @param {object} options
 * @param {import('../config.js').ConfigStore} [store]
 * @param {import('../credentials.js').CredentialStore} [credStore]
 */
export async function listCommand(
  options = {},
  store = defaultStore,
  credStore = defaultCredStore
) {
  const accounts = store.listAccounts();
  const globalUser = getCurrentGitUser('global');
  const inRepo = isInsideGitRepo();
  const localUser = inRepo ? getCurrentGitUser('local') : { name: null, email: null };

  if (accounts.length === 0) {
    console.log(info('No GitHub accounts registered in GitSwitch yet.'));
    console.log(`\n${pc.dim('Add your first account using:')}`);
    console.log(
      pc.cyan('  github add -uname "username" -uemail "your-email@example.com"\n')
    );
    if (globalUser.name || globalUser.email) {
      console.log(
        pc.dim(
          `Tip: You can import your current git user (${globalUser.name || 'unnamed'} <${globalUser.email || 'no-email'}>) by running:\n`
        ) + pc.cyan('  github import\n')
      );
    }
    return;
  }

  const table = new Table({
    head: [
      pc.bold('Status'),
      pc.bold('Username'),
      pc.bold('Email'),
      pc.bold('Credentials'),
      pc.bold('SSH Key'),
      pc.bold('Added / Used'),
    ],
    style: {
      head: ['cyan'],
      border: ['gray'],
    },
  });

  let activeAccountFound = false;

  for (const acc of accounts) {
    const isLocalMatch =
      inRepo &&
      localUser.name?.toLowerCase() === acc.username.toLowerCase() &&
      localUser.email?.toLowerCase() === acc.email.toLowerCase();

    const isGlobalMatch =
      globalUser.name?.toLowerCase() === acc.username.toLowerCase() &&
      globalUser.email?.toLowerCase() === acc.email.toLowerCase();

    let statusStr = pc.gray('-');
    if (isLocalMatch) {
      statusStr = pc.bold(pc.green('● Active (local)'));
      activeAccountFound = true;
    } else if (isGlobalMatch) {
      statusStr = pc.bold(pc.green('● Active (global)'));
      activeAccountFound = true;
    }

    const usernameDisplay =
      isLocalMatch || isGlobalMatch
        ? pc.bold(pc.green(acc.username))
        : acc.username;

    const emailDisplay =
      isLocalMatch || isGlobalMatch
        ? pc.bold(pc.green(acc.email))
        : acc.email;

    const hasCred =
      credStore.getCredential(acc.username) ||
      credStore.getCredential(acc.email);

    const credDisplay = hasCred
      ? pc.green('✔ Cached')
      : pc.dim('not cached');

    const sshDisplay = acc.sshKey ? pc.cyan(acc.sshKey) : pc.dim('none');

    const dateDisplay = acc.lastUsed
      ? pc.dim(`used ${new Date(acc.lastUsed).toLocaleDateString()}`)
      : pc.dim(`added ${new Date(acc.createdAt).toLocaleDateString()}`);

    table.push([
      statusStr,
      usernameDisplay,
      emailDisplay,
      credDisplay,
      sshDisplay,
      dateDisplay,
    ]);
  }

  console.log(`\n${pc.bold('Registered GitHub Accounts:')}`);
  console.log(table.toString());
  console.log(
    pc.dim(
      `Total: ${accounts.length} account${accounts.length > 1 ? 's' : ''}`
    )
  );

  if (!activeAccountFound && (globalUser.name || globalUser.email)) {
    console.log(
      `\n${pc.yellow('Notice:')} Current global git user (${globalUser.name} <${globalUser.email}>) does not match any saved account.`
    );
    console.log(
      pc.dim(`Save it with: `) +
        pc.cyan(
          `github add -uname "${globalUser.name || 'username'}" -uemail "${globalUser.email || 'email'}"\n`
        )
    );
  } else {
    console.log();
  }
}
