// Install the git hooks, in either repository layout.
//
// Stage 00 step 5 requires working pre-commit and pre-push hooks. Husky's own CLI
// installs them only when the package root *is* the git root. Today it is not: the
// monorepo sits in `infinite-ai/` inside a host repository (OQ-001), so `husky` prints
// ".git can't be found" and silently installs nothing — which is how an unformatted file
// reached CI on PR #1.
//
// This script handles both cases, so the hooks work now and keep working after
// scripts/spin-out-repo.sh moves the monorepo to its own repository root.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(...args) {
  return execFileSync('git', args, { cwd: packageRoot, encoding: 'utf8' }).trim();
}

let gitRoot;
try {
  gitRoot = git('rev-parse', '--show-toplevel');
} catch {
  // Not a git checkout — a tarball, a Docker build context, a vendored copy. Installing
  // hooks is not possible and not needed. Never fail an install over it.
  console.log('install-hooks: not a git repository, skipping.');
  process.exit(0);
}

const hooksDir = resolve(packageRoot, '.husky');
if (!existsSync(hooksDir)) {
  console.error(`install-hooks: ${hooksDir} is missing.`);
  process.exit(1);
}

// core.hooksPath is resolved relative to the git root, so it must be expressed that way.
const hooksPath = relative(gitRoot, hooksDir);
git('config', 'core.hooksPath', hooksPath);

console.log(`install-hooks: core.hooksPath set to ${hooksPath}`);
