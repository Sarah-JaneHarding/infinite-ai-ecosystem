// Stage 04 exit gate: "No provider SDK imported outside apps/gateway (lint rule plus a
// repo-wide test)." `eslint.config.mjs` already carries the lint rule, scoped to a single
// developer's working tree at a time; this is the version that runs over the whole repo in
// one pass, so the guarantee survives even if someone's editor has ESLint turned off.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.turbo',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'generated',
]);

/** The gateway's own adapters — the single sanctioned exception (rule 3). */
const ALLOWED_PREFIX = path.join(REPO_ROOT, 'apps', 'gateway', 'src', 'adapters');

const BANNED_IMPORT_PATTERN =
  /from\s+['"](@anthropic-ai\/|openai(\/|['"])|@google\/generative-ai|@google\/genai|@mistralai\/|cohere-ai|ollama|langchain)/;

function collectTsFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIR_NAMES.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
}

describe('no provider SDK is imported outside apps/gateway/src/adapters', () => {
  const files: string[] = [];
  collectTsFiles(REPO_ROOT, files);
  // A sanity floor: if this test somehow walked an empty tree, every assertion below
  // would trivially pass. Fail loudly instead of proving nothing.
  it('actually found source files to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  const offenders = files
    .filter((file) => !file.startsWith(ALLOWED_PREFIX))
    .filter((file) => BANNED_IMPORT_PATTERN.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(REPO_ROOT, file));

  it('finds no provider SDK import anywhere outside the adapters directory', () => {
    expect(offenders).toEqual([]);
  });
});
