// The real gate — Stage 06 step 3's own exit criterion, run against the actual tree.
//
// No agent has a real prompt yet (nothing module-specific goes in this stage), so this
// currently proves the trivial case: zero prompt files, zero lock entries, zero
// violations. It is wired for real, though — the moment Stage 08+ adds
// packages/prompts/src/<agent-id>/<semver>.prompt.md, this is what starts checking it
// against packages/prompts/prompt-lock.json, exactly like every other prompt in the
// system will be checked from then on.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadPromptFile, scanPromptFiles } from '../src/loader.js';
import { verifyPromptLock, type PromptLock } from '../src/lock.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = path.join(packageRoot, 'src');
const lockFilePath = path.join(packageRoot, 'prompt-lock.json');

describe('the real prompt tree against the checked-in lockfile', () => {
  it('has no drift between packages/prompts/src and prompt-lock.json', () => {
    const files = scanPromptFiles(srcDir);
    const prompts = files.map((file) => loadPromptFile(file));
    const lock = JSON.parse(readFileSync(lockFilePath, 'utf8')) as PromptLock;

    expect(verifyPromptLock(prompts, lock)).toEqual([]);
  });
});
