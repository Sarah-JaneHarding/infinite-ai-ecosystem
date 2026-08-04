import { describe, expect, it } from 'vitest';

import {
  CredentialPool,
  NoCredentialAvailableError,
} from '../../src/credentials/pool.js';

describe('CredentialPool — happy path', () => {
  it('round-robins across keys', () => {
    const pool = new CredentialPool('openai', ['key-a', 'key-b', 'key-c']);
    expect(pool.take().reveal()).toBe('key-a');
    expect(pool.take().reveal()).toBe('key-b');
    expect(pool.take().reveal()).toBe('key-c');
    expect(pool.take().reveal()).toBe('key-a');
  });

  it('reports how many keys are currently available', () => {
    const pool = new CredentialPool('openai', ['key-a', 'key-b']);
    expect(pool.availableCount()).toBe(2);
  });

  it('skips a key placed in cooldown and recovers it once the cooldown elapses', () => {
    let now = 0;
    const pool = new CredentialPool('openai', ['key-a', 'key-b'], {
      cooldownMs: 1000,
      now: () => now,
    });

    const first = pool.take();
    expect(first.reveal()).toBe('key-a');
    pool.reportRateLimited(first);

    // key-a is cooling down; the pool should skip straight to key-b.
    expect(pool.take().reveal()).toBe('key-b');
    expect(pool.availableCount()).toBe(1);

    now += 1001;
    expect(pool.availableCount()).toBe(2);
    expect(pool.take().reveal()).toBe('key-a');
  });
});

describe('CredentialPool — failure paths', () => {
  it('refuses to construct a pool with no keys', () => {
    expect(() => new CredentialPool('openai', [])).toThrow(
      'Credential pool for "openai" needs at least one key.',
    );
  });

  it('throws NoCredentialAvailableError when every key is cooling down', () => {
    const now = 0;
    const pool = new CredentialPool('openai', ['key-a'], {
      cooldownMs: 1000,
      now: () => now,
    });
    pool.reportRateLimited(pool.take());
    expect(() => pool.take()).toThrow(NoCredentialAvailableError);
  });

  it('never reveals a raw key value through anything but reveal()', () => {
    const pool = new CredentialPool('openai', ['super-secret-key']);
    const handle = pool.take();
    expect(handle.id).not.toContain('super-secret-key');
    expect(JSON.stringify(handle)).not.toContain('super-secret-key');
  });
});
