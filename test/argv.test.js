import { describe, it, expect } from 'vitest';
import { normalizeArgv } from '../src/utils/argv.js';

describe('normalizeArgv', () => {
  it('converts single-dash multi-letter flags into double-dash flags', () => {
    const input = [
      'node',
      'github',
      'add',
      '-uname',
      'alice',
      '-uemail',
      'alice@example.com',
    ];

    const output = normalizeArgv(input);

    expect(output).toEqual([
      'node',
      'github',
      'add',
      '--uname',
      'alice',
      '--uemail',
      'alice@example.com',
    ]);
  });

  it('keeps single-letter flags untouched', () => {
    const input = ['node', 'github', 'add', '-u', 'bob', '-e', 'bob@example.com', '-v', '-h'];
    const output = normalizeArgv(input);
    expect(output).toEqual(input);
  });

  it('keeps already double-dashed flags untouched', () => {
    const input = ['node', 'github', 'add', '--uname', 'charlie', '--uemail', 'charlie@example.com'];
    const output = normalizeArgv(input);
    expect(output).toEqual(input);
  });

  it('handles remove commands with -uname and -uemail', () => {
    const inputName = ['node', 'github', 'remove', '-uname', 'alice'];
    expect(normalizeArgv(inputName)).toEqual(['node', 'github', 'remove', '--uname', 'alice']);

    const inputEmail = ['node', 'github', 'remove', '-uemail', 'alice@test.com'];
    expect(normalizeArgv(inputEmail)).toEqual(['node', 'github', 'remove', '--uemail', 'alice@test.com']);
  });
});

