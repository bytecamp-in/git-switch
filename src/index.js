import { Command } from 'commander';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { currentCommand } from './commands/current.js';
import { switchCommand } from './commands/switch.js';
import { importCommand } from './commands/import.js';
import { credCommand } from './commands/cred.js';
import { normalizeArgv } from './utils/argv.js';
import { defaultStore } from './config.js';
import { defaultCredStore } from './credentials.js';

export function createProgram(store = defaultStore, credStore = defaultCredStore) {
  const program = new Command();

  program
    .name('github')
    .description('GitSwitch - Fast GitHub and Git account switcher with Windows Credential Manager caching')
    .version('1.0.0', '-v, --version', 'Output the current version');

  // List command
  program
    .command('list')
    .alias('ls')
    .description('View all saved GitHub user accounts')
    .action(async (options) => {
      await listCommand(options, store, credStore);
    });

  // Add command
  program
    .command('add [username] [email]')
    .description('Add a new GitHub account')
    .option('-u, --uname <username>', 'GitHub / Git username')
    .option('--name <username>', 'GitHub / Git username (alias)')
    .option('-e, --uemail <email>', 'Git email address')
    .option('--email <email>', 'Git email address (alias)')
    .option('-t, --token <token>', 'GitHub Personal Access Token (PAT) or password')
    .option('--pat <token>', 'GitHub Personal Access Token (alias)')
    .option('--pass <password>', 'GitHub Password (alias)')
    .option('--ssh <keyPath>', 'Path to SSH private key')
    .option('-s, --switch', 'Switch to this account immediately after adding')
    .action(async (posName, posEmail, options) => {
      await addCommand(posName, posEmail, options, store, credStore);
    });

  // Remove command
  program
    .command('remove [identifier]')
    .alias('rm')
    .alias('delete')
    .description('Remove a GitHub account by username or email')
    .option('-u, --uname <username>', 'GitHub username to remove')
    .option('--name <username>', 'GitHub username to remove (alias)')
    .option('-e, --uemail <email>', 'Git email to remove')
    .option('--email <email>', 'Git email to remove (alias)')
    .action(async (posIdentifier, options) => {
      await removeCommand(posIdentifier, options, store, credStore);
    });

  // Current command
  program
    .command('current')
    .alias('status')
    .alias('whoami')
    .description('View the currently active GitHub / Git account')
    .action(async (options) => {
      await currentCommand(options, store, credStore);
    });

  // Switch command
  program
    .command('switch [username]')
    .alias('use')
    .description('Switch active GitHub account and manage Windows Credential Manager cache')
    .option('-u, --uname <username>', 'Username to switch to')
    .option('-e, --uemail <email>', 'Email to switch to')
    .option('-l, --local', 'Apply only to current local git repository')
    .option('-g, --global', 'Apply globally (default)')
    .option('--no-cred', 'Do not clear or restore Windows Credential Manager entries')
    .option('--ssh', 'Also configure core.sshCommand if SSH key is registered')
    .action(async (target, options) => {
      await switchCommand(target, options, store, credStore);
    });

  // Import command
  program
    .command('import')
    .description('Import current git config user into GitSwitch')
    .action(async (options) => {
      await importCommand(options, store);
    });

  // Credential manager command
  program
    .command('cred [action] [param1] [param2]')
    .alias('credential')
    .alias('token')
    .description('Manage Windows Credential Manager cache (status, save, set, restore, clear)')
    .action(async (action, param1, param2, options) => {
      await credCommand(action, param1, param2, options, store, credStore);
    });

  return program;
}

export async function run(
  argv = process.argv,
  store = defaultStore,
  credStore = defaultCredStore
) {
  const normalized = normalizeArgv(argv);
  const program = createProgram(store, credStore);
  return program.parseAsync(normalized);
}
