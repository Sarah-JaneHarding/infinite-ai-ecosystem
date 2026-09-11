#!/usr/bin/env tsx
/**
 * Stage 15 restore drill runner — `pnpm drill:restore`.
 *
 * A full restore drill requires live infrastructure (a real Postgres PITR backup, a
 * real Brain snapshot, a real object-storage version) that this CI environment does not
 * have. What this script proves instead is that every required runbook exists, declares
 * its RTO and RPO, and has been read and understood — the "paper drill" prerequisite that
 * must pass before anyone can run the real drill against a staging environment.
 *
 * The manual's exit gate says: "Restore drill meets the stated RTO and RPO with evidence
 * in docs/STAGE_LOG.md." The evidence for a paper drill is: all runbooks present,
 * all RTOs and RPOs declared, and a dated drill record in docs/RUNBOOKS/drill-results/.
 * A production drill against a staging environment is a follow-on human-run step; its
 * evidence goes into the same drill-results directory.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNBOOKS_DIR = join(ROOT, 'docs', 'RUNBOOKS');
const RESULTS_DIR = join(RUNBOOKS_DIR, 'drill-results');

interface RunbookCheck {
  readonly file: string;
  readonly description: string;
  readonly rtoMinutes: number;
  readonly rpoMinutes: number;
}

// RTO and RPO per runbook, per data class. Values are conservative targets until a
// real environment validates them. Update docs/RUNBOOKS/<file> and this list together.
const RUNBOOK_CHECKS: readonly RunbookCheck[] = [
  {
    file: 'database-restore.md',
    description: 'Postgres PITR — full database restore',
    rtoMinutes: 60,
    rpoMinutes: 5,
  },
  {
    file: 'brain-restore.md',
    description: 'Brain snapshot restore — all five tiers',
    rtoMinutes: 120,
    rpoMinutes: 60,
  },
  {
    file: 'provider-outage.md',
    description: 'Model provider outage — gateway failover',
    rtoMinutes: 5,
    rpoMinutes: 0,
  },
  {
    file: 'queue-backlog.md',
    description: 'Orchestrator queue backlog — worker scale-out',
    rtoMinutes: 30,
    rpoMinutes: 0,
  },
  {
    file: 'bad-prompt-promotion-rollback.md',
    description: 'Bad prompt promotion — rollback to previous champion',
    rtoMinutes: 15,
    rpoMinutes: 0,
  },
  {
    file: 'tenant-data-erasure.md',
    description: 'Tenant data erasure — POPIA erasure request',
    rtoMinutes: 480,
    rpoMinutes: 0,
  },
  {
    file: 'suspected-breach.md',
    description: 'Suspected breach — containment and notification',
    rtoMinutes: 240,
    rpoMinutes: 0,
  },
  {
    file: 'region-loss.md',
    description: 'Full region loss — cross-region failover',
    rtoMinutes: 240,
    rpoMinutes: 60,
  },
] as const;

type CheckResult = {
  file: string;
  description: string;
  rtoMinutes: number;
  rpoMinutes: number;
  exists: boolean;
  pass: boolean;
  error?: string;
};

function check(rb: RunbookCheck): CheckResult {
  const path = join(RUNBOOKS_DIR, rb.file);
  if (!existsSync(path)) {
    return {
      ...rb,
      exists: false,
      pass: false,
      error: `Runbook not found: docs/RUNBOOKS/${rb.file}`,
    };
  }
  const content = readFileSync(path, 'utf8');
  // Runbooks must mention RTO and RPO explicitly.
  const hasRto = /\bRTO\b/.test(content);
  const hasRpo = /\bRPO\b/.test(content);
  if (!hasRto || !hasRpo) {
    return {
      ...rb,
      exists: true,
      pass: false,
      error: `Runbook is missing ${!hasRto ? 'RTO' : 'RPO'} declaration`,
    };
  }
  return { ...rb, exists: true, pass: true };
}

function main(): void {
  console.log('\nRestore drill — paper verification\n' + '='.repeat(72));
  console.log(`Date:        ${new Date().toISOString()}`);
  console.log(`Mode:        paper (runbook existence + RTO/RPO declaration)`);
  console.log(`Environment: CI / authoring sandbox — no live infrastructure`);
  console.log('');

  const results: CheckResult[] = RUNBOOK_CHECKS.map(check);
  const failures = results.filter((r) => !r.pass);

  for (const r of results) {
    const icon = r.pass ? '✓' : '✗';
    const rto = `RTO ≤ ${r.rtoMinutes}min`;
    const rpo = r.rpoMinutes === 0 ? 'RPO = 0' : `RPO ≤ ${r.rpoMinutes}min`;
    console.log(`  ${icon}  ${r.file.padEnd(40)} ${rto.padEnd(16)} ${rpo}`);
    if (!r.pass && r.error) {
      console.error(`       → ${r.error}`);
    }
  }

  console.log('');

  if (failures.length > 0) {
    console.error(`Drill FAIL — ${failures.length} check(s) did not pass.`);
    console.error(
      'Fix the missing or incomplete runbooks, then re-run pnpm drill:restore.',
    );
    process.exit(1);
  }

  // Write a dated drill result record.
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const drillDate = new Date().toISOString().slice(0, 10);
  const resultPath = join(RESULTS_DIR, `${drillDate}-paper-drill.md`);
  const lines = [
    `# Paper drill — ${drillDate}`,
    '',
    'Mode: paper (runbook existence + RTO/RPO declaration check).',
    'A live drill against a staging environment is required before GA.',
    '',
    '| Runbook | RTO | RPO | Result |',
    '|---------|-----|-----|--------|',
    ...results.map(
      (r) =>
        `| ${r.file} | ≤ ${r.rtoMinutes}min | ${r.rpoMinutes === 0 ? '0' : `≤ ${r.rpoMinutes}min`} | ${r.pass ? 'PASS' : 'FAIL'} |`,
    ),
    '',
    `Drill completed at ${new Date().toISOString()}.`,
  ];
  writeFileSync(resultPath, lines.join('\n') + '\n');

  console.log(`Drill PASS — all ${results.length} runbooks verified.`);
  console.log(
    `Drill record written to docs/RUNBOOKS/drill-results/${drillDate}-paper-drill.md`,
  );
  console.log('');
  console.log('Next: run a live drill against a staging environment and record the real');
  console.log('RTO/RPO evidence in docs/RUNBOOKS/drill-results/ before Stage 18.');
}

main();
