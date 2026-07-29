#!/usr/bin/env tsx
/**
 * Stage gate runner — Part 6 §6.2: `pnpm verify:stage <NN>` must exit 0 before the
 * next stage begins.
 *
 * Each stage's verification set is declared here as data so a gate is reproducible by
 * anyone, on any machine, without reading the manual. A stage runs its own commands
 * plus every earlier stage's, because §0.4 requires that the cumulative test command
 * still passes — a gate that only checks the newest work cannot catch a regression.
 */

import { spawnSync } from 'node:child_process';

interface Stage {
  readonly id: string;
  readonly name: string;
  /** Commands that must all exit 0. Empty means the stage is not yet implemented. */
  readonly commands: readonly string[];
}

const STAGES: readonly Stage[] = [
  {
    id: '00',
    name: 'Ground rules, repository, toolchain',
    commands: [
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test',
      'pnpm build',
      'pnpm format:check',
    ],
  },
  {
    id: '01',
    name: 'Data foundation, tenancy, RLS',
    commands: [
      // Requires Docker: the RLS suite runs against real Postgres via Testcontainers.
      // There is no skip path — rule 2 — so this fails loudly where Docker is absent.
      'pnpm --filter @infinite-ai/db test:integration',
    ],
  },
  { id: '02', name: 'Identity, RBAC, audit ledger', commands: [] },
  { id: '03', name: 'POPIA layer', commands: [] },
  { id: '04', name: 'Model Gateway', commands: [] },
  { id: '05', name: 'Infinite Brain (L0-L4)', commands: [] },
  { id: '06', name: 'Agent runtime, orchestrator, guardrails, HITL', commands: [] },
  { id: '07', name: 'Eval harness and golden sets', commands: [] },
  { id: '08', name: 'MOD-01 Curriculum Engine', commands: [] },
  { id: '09', name: 'MOD-03 Data Warehouse', commands: [] },
  { id: '10', name: 'MOD-02 Support Analytics Centre', commands: [] },
  { id: '11', name: 'MOD-04 Teaching & Learning Toolbox', commands: [] },
  { id: '12', name: 'MOD-05 Teaching Analytics & PD Studio', commands: [] },
  { id: '13', name: 'LE Learning Engine', commands: [] },
  { id: '14', name: 'Experience surfaces', commands: [] },
  { id: '15', name: 'Observability, SLOs, DR', commands: [] },
  { id: '16', name: 'Security hardening', commands: [] },
  { id: '17', name: 'Tenant lifecycle, provisioning, billing', commands: [] },
  { id: '18', name: 'Launch readiness and handover', commands: [] },
];

function usage(): never {
  console.error('Usage: pnpm verify:stage <NN>   e.g. pnpm verify:stage 00');
  console.error(`Known stages: ${STAGES.map((stage) => stage.id).join(', ')}`);
  process.exit(2);
}

function run(command: string): boolean {
  console.log(`\n[36m$ ${command}[0m`);
  const result = spawnSync(command, { shell: true, stdio: 'inherit' });
  return result.status === 0;
}

function main(): void {
  const raw = process.argv[2];
  if (raw === undefined) usage();

  const target = raw.padStart(2, '0');
  const index = STAGES.findIndex((stage) => stage.id === target);
  if (index === -1) usage();

  // Cumulative: this stage and every stage before it.
  const toRun = STAGES.slice(0, index + 1);
  const stage = STAGES[index]!;

  console.log(`\nVerifying Stage ${stage.id} — ${stage.name}`);
  console.log(`Running the cumulative gate for stages ${toRun[0]!.id}..${stage.id}.`);

  const pending = toRun.filter((candidate) => candidate.commands.length === 0);
  const runnable = toRun.filter((candidate) => candidate.commands.length > 0);

  const failures: string[] = [];
  for (const candidate of runnable) {
    for (const command of candidate.commands) {
      if (!run(command)) failures.push(`stage ${candidate.id}: ${command}`);
    }
  }

  console.log('\n' + '-'.repeat(72));
  if (pending.length > 0) {
    console.log(
      `Not yet implemented (no commands declared): ${pending
        .map((candidate) => candidate.id)
        .join(', ')}`,
    );
  }

  if (failures.length > 0) {
    console.error(`\n[31mStage ${stage.id} gate: FAIL[0m`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    console.error(
      '\nRule 1: do not proceed to the next stage. Rule 2: do not weaken a test to pass.',
    );
    process.exit(1);
  }

  if (stage.commands.length === 0) {
    console.error(`\n[33mStage ${stage.id} declares no verification commands yet.[0m`);
    console.error('Add them to scripts/verify-stage.ts as part of the stage.');
    process.exit(1);
  }

  console.log(`\n[32mStage ${stage.id} gate: PASS[0m`);
  console.log('Record the result in docs/STAGE_LOG.md before starting the next stage.');
}

main();
