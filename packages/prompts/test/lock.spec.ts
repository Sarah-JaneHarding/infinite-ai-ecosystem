import { describe, expect, it } from 'vitest';

import type { LoadedPrompt } from '../src/loader.js';
import { buildPromptLock, verifyPromptLock } from '../src/lock.js';

function prompt(agent: string, version: string, hash: string): LoadedPrompt {
  return {
    frontMatter: {
      agent,
      version,
      model: 'plan.author',
      changelog: 'x',
      author: 'x',
      ratified_by: null,
    },
    body: 'x',
    hash,
  };
}

describe('verifyPromptLock', () => {
  it('reports no violations when every hash matches the lock exactly', () => {
    const prompts = [prompt('CE-05', '1.0.0', 'aaa')];
    const violations = verifyPromptLock(prompts, { 'CE-05@1.0.0': 'aaa' });
    expect(violations).toEqual([]);
  });

  it('reports missing_from_lock for a prompt with no lock entry', () => {
    const prompts = [prompt('CE-05', '1.0.0', 'aaa')];
    const violations = verifyPromptLock(prompts, {});
    expect(violations).toEqual([
      { key: 'CE-05@1.0.0', reason: 'missing_from_lock', actualHash: 'aaa' },
    ]);
  });

  it('reports hash_mismatch when a prompt was edited without a version bump', () => {
    const prompts = [prompt('CE-05', '1.0.0', 'edited-hash')];
    const violations = verifyPromptLock(prompts, { 'CE-05@1.0.0': 'original-hash' });
    expect(violations).toEqual([
      { key: 'CE-05@1.0.0', reason: 'hash_mismatch', actualHash: 'edited-hash' },
    ]);
  });

  it('checks every prompt independently, in a mixed batch', () => {
    const prompts = [
      prompt('CE-05', '1.0.0', 'ok-hash'),
      prompt('CE-06', '1.0.0', 'edited-hash'),
      prompt('CE-07', '1.0.0', 'new-hash'),
    ];
    const violations = verifyPromptLock(prompts, {
      'CE-05@1.0.0': 'ok-hash',
      'CE-06@1.0.0': 'original-hash',
    });
    expect(violations).toEqual([
      { key: 'CE-06@1.0.0', reason: 'hash_mismatch', actualHash: 'edited-hash' },
      { key: 'CE-07@1.0.0', reason: 'missing_from_lock', actualHash: 'new-hash' },
    ]);
  });
});

describe('buildPromptLock', () => {
  it('produces a lock that verifies clean against the same prompts', () => {
    const prompts = [prompt('CE-05', '1.0.0', 'aaa'), prompt('CE-06', '2.1.0', 'bbb')];
    const lock = buildPromptLock(prompts);
    expect(lock).toEqual({ 'CE-05@1.0.0': 'aaa', 'CE-06@2.1.0': 'bbb' });
    expect(verifyPromptLock(prompts, lock)).toEqual([]);
  });
});
