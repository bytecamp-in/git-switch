import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ConfigStore } from '../src/config.js';

describe('ConfigStore', () => {
  let tempDir;
  let configPath;
  let store;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitswitch-test-'));
    configPath = path.join(tempDir, 'config.json');
    store = new ConfigStore(configPath);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes with empty accounts list', () => {
    const accounts = store.listAccounts();
    expect(accounts).toEqual([]);
  });

  it('adds an account successfully', () => {
    const result = store.addAccount({
      username: 'johndoe',
      email: 'john@example.com',
    });

    expect(result.isNew).toBe(true);
    expect(result.account.username).toBe('johndoe');
    expect(result.account.email).toBe('john@example.com');

    const list = store.listAccounts();
    expect(list.length).toBe(1);
    expect(list[0].username).toBe('johndoe');
  });

  it('updates an existing account on duplicate username or email when overwrite is true', () => {
    store.addAccount({
      username: 'johndoe',
      email: 'john@example.com',
    });

    const result = store.addAccount({
      username: 'johndoe',
      email: 'newemail@example.com',
      overwrite: true,
    });

    expect(result.isNew).toBe(false);
    expect(result.account.email).toBe('newemail@example.com');
    expect(store.listAccounts().length).toBe(1);
  });

  it('removes an account by username', () => {
    store.addAccount({ username: 'user1', email: 'user1@example.com' });
    store.addAccount({ username: 'user2', email: 'user2@example.com' });

    const removed = store.removeAccount({ username: 'user1' });
    expect(removed).not.toBeNull();
    expect(removed.username).toBe('user1');

    const accounts = store.listAccounts();
    expect(accounts.length).toBe(1);
    expect(accounts[0].username).toBe('user2');
  });

  it('removes an account by email', () => {
    store.addAccount({ username: 'user1', email: 'user1@example.com' });
    store.addAccount({ username: 'user2', email: 'user2@example.com' });

    const removed = store.removeAccount({ email: 'user2@example.com' });
    expect(removed).not.toBeNull();
    expect(removed.email).toBe('user2@example.com');

    const accounts = store.listAccounts();
    expect(accounts.length).toBe(1);
    expect(accounts[0].username).toBe('user1');
  });

  it('returns null if account to remove is not found', () => {
    const removed = store.removeAccount({ username: 'nonexistent' });
    expect(removed).toBeNull();
  });

  it('finds account by username or email case-insensitively', () => {
    store.addAccount({ username: 'AliceBob', email: 'alice@example.com' });

    expect(store.findAccount('alicebob')).not.toBeNull();
    expect(store.findAccount('ALICE@EXAMPLE.COM')).not.toBeNull();
    expect(store.findAccount('unknown')).toBeNull();
  });
});

