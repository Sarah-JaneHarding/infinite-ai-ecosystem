// The prompt lockfile — Stage 06 step 3.
//
// "The loader is content-hashed; a prompt cannot be edited in place without a version
// bump (enforced by a test that compares hashes to a lockfile)." The lockfile is a plain
// checked-in JSON map of `<agent>@<version>` to the sha256 hash `loader.ts` computed for
// it the day that version was added. A prompt file changing without its version bumping
// shows up as a hash mismatch against the same key; a prompt file with no lock entry at
// all is a new or bumped version nobody has recorded yet — both are drift a caller must
// fix, the same "no ambient state a check silently tolerates" reasoning `pnpm install
// --frozen-lockfile` already applies to this repo's own dependency lockfile.

import type { LoadedPrompt, PromptFrontMatter } from './loader.js';

/** `<agent>@<version>` → the sha256 hash recorded for it. */
export type PromptLock = Record<string, string>;

export type PromptLockViolationReason = 'hash_mismatch' | 'missing_from_lock';

export interface PromptLockViolation {
  readonly key: string;
  readonly reason: PromptLockViolationReason;
  readonly actualHash: string;
}

function lockKey(frontMatter: PromptFrontMatter): string {
  return `${frontMatter.agent}@${frontMatter.version}`;
}

/**
 * Every way a set of loaded prompts disagrees with a lockfile: a key present in both
 * whose hash differs (edited in place without a version bump), or a prompt with no entry
 * in the lock at all (a new or bumped version the lockfile was never updated for). Empty
 * means every prompt matches exactly what was locked for it.
 */
export function verifyPromptLock(
  prompts: readonly LoadedPrompt[],
  lock: PromptLock,
): readonly PromptLockViolation[] {
  const violations: PromptLockViolation[] = [];
  for (const prompt of prompts) {
    const key = lockKey(prompt.frontMatter);
    const expectedHash = lock[key];
    if (expectedHash === undefined) {
      violations.push({ key, reason: 'missing_from_lock', actualHash: prompt.hash });
    } else if (expectedHash !== prompt.hash) {
      violations.push({ key, reason: 'hash_mismatch', actualHash: prompt.hash });
    }
  }
  return violations;
}

/** The lockfile a set of loaded prompts implies — what a developer regenerates after
 * intentionally adding a prompt or bumping one's version, the same "regenerate, review,
 * commit" workflow `pnpm-lock.yaml` itself already uses in this repo. */
export function buildPromptLock(prompts: readonly LoadedPrompt[]): PromptLock {
  const lock: PromptLock = {};
  for (const prompt of prompts) {
    lock[lockKey(prompt.frontMatter)] = prompt.hash;
  }
  return lock;
}
