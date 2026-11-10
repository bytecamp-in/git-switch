import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CredentialStore, maskToken } from '../src/credentials.js';

describe('CredentialStore', () => {
  let tempDir;
  let credPath;
  let credStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitswitch-cred-test-'));
    credPath = path.join(tempDir, 'credentials.json');
    credStore = new CredentialStore(credPath);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('stores and retrieves credentials by username and email', () => {
    credStore.setCredential('alice', 'ghp_secretToken12345', 'alice@company.com');

    const byUser = credStore.getCredential('alice');
    expect(byUser).not.toBeNull();
    expect(byUser.username).toBe('alice');
    expect(byUser.token).toBe('ghp_secretToken12345');
    expect(byUser.email).toBe('alice@company.com');

    const byEmail = credStore.getCredential('alice@company.com');
    expect(byEmail).not.toBeNull();
    expect(byEmail.username).toBe('alice');

    // Case-insensitivity check
    expect(credStore.getCredential('ALICE')).not.toBeNull();
  });

  it('removes credentials', () => {
    credStore.setCredential('bob', 'token123');
    expect(credStore.getCredential('bob')).not.toBeNull();

    const removed = credStore.removeCredential('bob');
    expect(removed).toBe(true);
    expect(credStore.getCredential('bob')).toBeNull();
  });

  it('masks tokens properly', () => {
    expect(maskToken('ghp_1234567890abcdef')).toBe('ghp_12...cdef');
    expect(maskToken('short')).toBe('********');
    expect(maskToken('')).toBe('none');
  });

  it('lists credentials with masked tokens', () => {
    credStore.setCredential('user1', 'token123456789', 'user1@test.com');
    const list = credStore.listCredentials();
    expect(list.length).toBe(1);
    expect(list[0].username).toBe('user1');
    expect(list[0].maskedToken).toBe('token1...6789');
  });
});

