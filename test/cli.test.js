import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../src/config.js';
import { CredentialStore } from '../src/credentials.js';
import { run } from '../src/index.js';
import * as git from '../src/git.js';
import * as creds from '../src/credentials.js';

// Helper to remove ANSI escape codes for testing log strings
function stripAnsi(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('CLI Integration', () => {
  let tempDir;
  let configPath;
  let credPath;
  let testStore;
  let testCredStore;
  let consoleLogs;
  let consoleErrors;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitswitch-cli-test-'));
    configPath = path.join(tempDir, 'config.json');
    credPath = path.join(tempDir, 'credentials.json');
    testStore = new ConfigStore(configPath);
    testCredStore = new CredentialStore(credPath);

    consoleLogs = [];
    consoleErrors = [];

    vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogs.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors.push(args.join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('runs "github add -uname user1 -uemail user1@example.com -token ghp_xyz"', async () => {
    await run(
      [
        'node',
        'github',
        'add',
        '-uname',
        'user1',
        '-uemail',
        'user1@example.com',
        '-token',
        'ghp_xyz12345',
      ],
      testStore,
      testCredStore
    );

    const accounts = testStore.listAccounts();
    expect(accounts.length).toBe(1);
    expect(accounts[0].username).toBe('user1');
    expect(accounts[0].email).toBe('user1@example.com');

    const cred = testCredStore.getCredential('user1');
    expect(cred).not.toBeNull();
    expect(cred.token).toBe('ghp_xyz12345');
  });

  it('runs "github list" and outputs saved accounts', async () => {
    testStore.addAccount({ username: 'dev1', email: 'dev1@example.com' });
    testStore.addAccount({ username: 'dev2', email: 'dev2@example.com' });

    await run(['node', 'github', 'list'], testStore, testCredStore);

    const joined = stripAnsi(consoleLogs.join('\n'));
    expect(joined).toContain('dev1');
    expect(joined).toContain('dev2');
    expect(joined).toContain('dev1@example.com');
  });

  it('runs "github switch username", caches active credential, clears Windows Credential Manager, and restores target', async () => {
    // Current active git user is "userA", switching to "userB"
    testStore.addAccount({ username: 'userA', email: 'userA@corp.com' });
    testStore.addAccount({ username: 'userB', email: 'userB@corp.com' });

    // userB already has a cached token
    testCredStore.setCredential('userB', 'ghp_token_for_userB', 'userB@corp.com');

    // Mock active credential in Windows Credential Manager as userA
    vi.spyOn(creds, 'readCurrentGitCredential').mockReturnValue({
      username: 'userA',
      password: 'ghp_active_token_for_userA',
    });

    const deleteCredSpy = vi
      .spyOn(creds, 'deleteWindowsCredential')
      .mockReturnValue({ deletedLegacy: true, deletedDirect: true });
    const setCredSpy = vi
      .spyOn(creds, 'setWindowsCredential')
      .mockImplementation(() => {});
    const setGitConfigSpy = vi
      .spyOn(git, 'setGitConfig')
      .mockImplementation(() => {});

    await run(['node', 'github', 'switch', 'userB'], testStore, testCredStore);

    // 1. Should cache userA's active credential
    const userACred = testCredStore.getCredential('userA');
    expect(userACred).not.toBeNull();
    expect(userACred.token).toBe('ghp_active_token_for_userA');

    // 2. Should delete from Windows Credential Manager
    expect(deleteCredSpy).toHaveBeenCalledWith('git:https://github.com');

    // 3. Should update git config
    expect(setGitConfigSpy).toHaveBeenCalledWith('user.name', 'userB', 'global');
    expect(setGitConfigSpy).toHaveBeenCalledWith('user.email', 'userB@corp.com', 'global');

    // 4. Should restore userB's cached credential
    expect(setCredSpy).toHaveBeenCalledWith(
      'userB',
      'ghp_token_for_userB',
      'git:https://github.com'
    );

    const joined = stripAnsi(consoleLogs.join('\n'));
    expect(joined).toContain('Cached active credential for userA');
    expect(joined).toContain('cmdkey /delete:LegacyGeneric:target=git:https://github.com');
    expect(joined).toContain('Switched to GitHub account: userB <userB@corp.com>');
    expect(joined).toContain('Restored cached credentials for userB');
  });

  it('runs "github remove -uname username" and removes cached credentials', async () => {
    testStore.addAccount({ username: 'tempuser', email: 'temp@example.com' });
    testCredStore.setCredential('tempuser', 'ghp_temp');
    expect(testStore.listAccounts().length).toBe(1);

    await run(
      ['node', 'github', 'remove', '-uname', 'tempuser'],
      testStore,
      testCredStore
    );

    expect(testStore.listAccounts().length).toBe(0);
    expect(testCredStore.getCredential('tempuser')).toBeNull();

    const joined = stripAnsi(consoleLogs.join('\n'));
    expect(joined).toContain('Removed GitHub account: tempuser <temp@example.com>');
  });

  it('runs "github current" and displays config and Windows Credential status', async () => {
    vi.spyOn(git, 'getCurrentGitUser').mockReturnValue({
      name: 'current_user',
      email: 'current@example.com',
    });
    vi.spyOn(git, 'isInsideGitRepo').mockReturnValue(false);
    vi.spyOn(creds, 'readCurrentGitCredential').mockReturnValue({
      username: 'current_user',
      password: 'ghp_secret_token',
    });

    await run(['node', 'github', 'current'], testStore, testCredStore);

    const joined = stripAnsi(consoleLogs.join('\n'));
    expect(joined).toContain('current_user');
    expect(joined).toContain('current@example.com');
    expect(joined).toContain('Windows Credential Manager');
  });

  it('runs "github cred clear" to trigger cmdkey delete', async () => {
    const deleteCredSpy = vi
      .spyOn(creds, 'deleteWindowsCredential')
      .mockReturnValue({ deletedLegacy: true, deletedDirect: true });

    await run(['node', 'github', 'cred', 'clear'], testStore, testCredStore);

    expect(deleteCredSpy).toHaveBeenCalledWith('git:https://github.com');
    const joined = stripAnsi(consoleLogs.join('\n'));
    expect(joined).toContain('cmdkey /delete:LegacyGeneric:target=git:https://github.com');
  });
});
