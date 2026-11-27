import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// Audit finding, Stage 149: a declared guardrail with no checker used to be silently skipped. The
// step executor now refuses such a call before any model call. The ONE way around it is
// `allowUnwiredGuardrails`, which exists for the dev runners (confined to synthetic fixture
// tenants and never run under NODE_ENV=production). These tests keep it that way: if anything
// else, above all the production worker, starts setting it, a test fails.

const REPO = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Files, relative to the repo root and with forward slashes, that SET the opt-out to true. */
function filesSettingTheOptOut(): string[] {
  const roots = [join(REPO, 'apps'), join(REPO, 'packages'), join(REPO, 'scripts')];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const rel = relative(REPO, file).split('\\').join('/');
      if (rel.includes('/test/') || /\.spec\.[tj]sx?$/.test(rel)) continue;
      if (/allowUnwiredGuardrails\s*:\s*true/.test(readFileSync(file, 'utf8'))) {
        hits.push(rel);
      }
    }
  }
  return hits.sort();
}

describe('the unwired-guardrail opt-out stays a dev-runner-only switch', () => {
  it('is set to true by exactly the two dev entry points and the job-processor pass-through', () => {
    expect(filesSettingTheOptOut()).toEqual([
      'apps/worker/src/dev/agent-runner.ts',
      'apps/worker/src/job-processor.ts',
      'scripts/dev-run-pipeline.ts',
    ]);
  });

  it('never appears in the production worker wiring', () => {
    for (const file of ['apps/worker/src/worker-host.ts', 'apps/worker/src/index.ts']) {
      const text = readFileSync(join(REPO, file), 'utf8');
      expect(text, file).not.toContain('allowUnwiredGuardrails');
    }
  });

  it('is only ever set after the dev guard has confined the run (pipeline runner script)', () => {
    const text = readFileSync(join(REPO, 'scripts/dev-run-pipeline.ts'), 'utf8');
    const guard = text.indexOf('assertDevRun(');
    const optOut = text.search(/allowUnwiredGuardrails\s*:\s*true/);
    expect(guard).toBeGreaterThan(-1);
    expect(optOut).toBeGreaterThan(guard);
  });

  it('the job processor passes the opt-out through only when it is exactly true', () => {
    const text = readFileSync(join(REPO, 'apps/worker/src/job-processor.ts'), 'utf8');
    expect(text).toMatch(/deps\.allowUnwiredGuardrails === true/);
  });
});
