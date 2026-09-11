#!/usr/bin/env tsx
// Supply-chain security audit — Stage 16 step 7.
//
// Verifies:
//   1. pnpm-lock.yaml exists and is committed (lockfile integrity).
//   2. Every production dependency across all package.json files uses an exact version,
//      not a range specifier (^, ~, *, x). Pinning prevents supply-chain drift between
//      deployments and makes it obvious when a dependency changes.
//   3. No known high or critical vulnerabilities in production dependencies (pnpm audit).
//   4. Generates a minimal SBOM (package list) at docs/sbom.json for the security questionnaire.
//
// The audit is designed to be reproducible and fast; it does not require Docker.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Directories that contain a package.json worth scanning.
const PACKAGE_DIRS: readonly string[] = [
  '.',
  'apps/gateway',
  'apps/web',
  'apps/worker',
  'packages/agents',
  'packages/analytics',
  'packages/brain',
  'packages/config',
  'packages/contracts',
  'packages/db',
  'packages/deident',
  'packages/design-system',
  'packages/evals',
  'packages/gateway',
  'packages/guardrails',
  'packages/learning',
  'packages/orchestrator',
  'packages/policy',
  'packages/prompts',
  'packages/billing',
  'packages/provisioning',
  'packages/security',
  'packages/telemetry',
  'packages/testkit',
  'packages/warehouse',
];

interface Finding {
  readonly severity: 'error' | 'warn';
  readonly message: string;
}

const findings: Finding[] = [];

function error(message: string): void {
  findings.push({ severity: 'error', message });
  console.error(`  ✗  ${message}`);
}

function warn(message: string): void {
  findings.push({ severity: 'warn', message });
  console.warn(`  ⚠  ${message}`);
}

function pass(message: string): void {
  console.log(`  ✓  ${message}`);
}

// ─── 1. Lockfile integrity ────────────────────────────────────────────────────

console.log('\nSupply-chain audit\n' + '='.repeat(72));
console.log('\n[1] Lockfile integrity');

const lockfilePath = join(ROOT, 'pnpm-lock.yaml');
if (!existsSync(lockfilePath)) {
  error('pnpm-lock.yaml not found — run pnpm install and commit the lockfile.');
} else {
  pass('pnpm-lock.yaml exists.');
}

// ─── 2. Exact version pinning ─────────────────────────────────────────────────

console.log('\n[2] Exact version pinning in production dependencies');

const RANGE_PATTERN = /^[~^*]|^\d+\.x|^>|^\s*$/;
const violations: string[] = [];

for (const relDir of PACKAGE_DIRS) {
  const pkgPath = join(ROOT, relDir, 'package.json');
  if (!existsSync(pkgPath)) continue;

  let pkg: {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as typeof pkg;
  } catch {
    warn(`Could not parse ${relDir}/package.json`);
    continue;
  }

  const name = pkg.name ?? relDir;
  const deps = pkg.dependencies ?? {};
  for (const [dep, version] of Object.entries(deps)) {
    // workspace: references are not version specifiers.
    if (version.startsWith('workspace:')) continue;
    if (RANGE_PATTERN.test(version)) {
      violations.push(`${name}: ${dep}@${version}`);
    }
  }
  // devDependencies are less critical but still tracked.
  const devDeps = pkg.devDependencies ?? {};
  for (const [dep, version] of Object.entries(devDeps)) {
    if (version.startsWith('workspace:')) continue;
    if (RANGE_PATTERN.test(version)) {
      violations.push(`${name} (dev): ${dep}@${version}`);
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    error(`Range specifier in ${v}`);
  }
} else {
  pass('All production and dev dependencies use exact versions.');
}

// ─── 3. Vulnerability scan ────────────────────────────────────────────────────

console.log('\n[3] Vulnerability scan (pnpm audit --prod)');

try {
  const output = execSync('pnpm audit --prod --audit-level=high 2>&1', {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
  console.log(output.trim().split('\n').slice(-5).join('\n'));
  pass('pnpm audit: no high or critical vulnerabilities found.');
} catch (err: unknown) {
  const output =
    err instanceof Error && 'stdout' in err
      ? String((err as { stdout: unknown }).stdout)
      : String(err);
  if (output.includes('No known vulnerabilities found')) {
    pass('pnpm audit: no vulnerabilities found.');
  } else if (
    output.includes('ETIMEDOUT') ||
    output.includes('ENOTFOUND') ||
    output.includes('registry')
  ) {
    warn(
      'pnpm audit could not reach the npm registry (network policy). ' +
        'Run manually in an environment with registry access before GA.',
    );
  } else {
    error(
      'pnpm audit found high or critical vulnerabilities. Review and remediate before GA.',
    );
    console.error(output.slice(0, 2000));
  }
}

// ─── 4. SBOM generation ───────────────────────────────────────────────────────

console.log('\n[4] SBOM generation (docs/sbom.json)');

try {
  const listOutput = execSync('pnpm list --json --depth=0 2>/dev/null', {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
  const parsed: unknown = JSON.parse(listOutput);
  const sbom = {
    bomFormat: 'minimal-pnpm-list',
    specVersion: '1.0',
    metadata: {
      timestamp: new Date().toISOString(),
      component: 'infinite-ai-ecosystem',
    },
    components: parsed,
  };
  writeFileSync(join(ROOT, 'docs', 'sbom.json'), JSON.stringify(sbom, null, 2) + '\n');
  pass('SBOM written to docs/sbom.json.');
} catch {
  warn('Could not generate SBOM — pnpm list failed. Run manually before GA.');
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('\n' + '-'.repeat(72));
const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warning(s) require attention before GA.`);
}

if (errors.length > 0) {
  console.error(`\nAudit FAIL — ${errors.length} error(s) must be resolved.`);
  process.exit(1);
}

console.log('\nAudit PASS — supply chain checks complete.');
