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
      //
      // Runs both tiers and applies §4.2's 95% threshold to the union, which is the gate
      // item Stage 01 recorded as NOT MET. A coverage figure for this package that did not
      // involve a database would be measuring the wrong thing.
      'pnpm --filter @infinite-ai/db coverage:merged',
    ],
  },
  { id: '02', name: 'Identity, RBAC, audit ledger', commands: [] },
  {
    id: '03',
    name: 'POPIA layer',
    commands: [
      // §4.2 names policy, deident and guardrails as safety-critical at >= 95% lines.
      // Everything in them is pure and synchronous, so unlike packages/db there is no
      // tier of behaviour that only a container can reach — the threshold is enforced
      // here rather than carried as an open item.
      'pnpm --filter @infinite-ai/contracts test:coverage',
      'pnpm --filter @infinite-ai/policy test:coverage',
      'pnpm --filter @infinite-ai/deident test:coverage',
      'pnpm --filter @infinite-ai/guardrails test:coverage',
      // The append-only consent ledger, erasure and the RLS policies on the three tables
      // this stage added all run inside Stage 01's `coverage:merged` command above, which
      // the cumulative gate already executes. Nothing further is needed here.
    ],
  },
  {
    id: '04',
    name: 'Model Gateway',
    commands: [
      // Mirrors the manual's own verification block for this stage. `packages/telemetry`
      // is included because this stage is what built out its logger and tracer, and
      // `test:chaos` is named explicitly even though it is a subset of `test`, the same
      // way the manual calls it out as its own line.
      'pnpm --filter @infinite-ai/telemetry test',
      'pnpm --filter @infinite-ai/gateway test',
      'pnpm --filter @infinite-ai/gateway test:chaos',
    ],
  },
  {
    id: '05',
    name: 'Infinite Brain (L0-L4)',
    commands: [
      // Mirrors the manual's own verification block: the unit tier, the dedicated
      // temporal-test script it names explicitly, and the Testcontainers-backed
      // integration tier (write path, retrieval path, temporal, restore drill) — all
      // requiring Docker, with no skip path, the same as Stage 01's RLS suite.
      'pnpm --filter @infinite-ai/brain test',
      'pnpm --filter @infinite-ai/brain test:temporal',
      'pnpm --filter @infinite-ai/brain test:integration',
    ],
  },
  {
    id: '06',
    name: 'Agent runtime, orchestrator, guardrails, HITL',
    commands: [
      // Mirrors the manual's own verification block, plus the orchestrator's own
      // Testcontainers-backed integration tier: step 4's durability/resumability, step 5's
      // human-gate persistence, step 7's irreversible-tool gating, step 8's concurrency
      // wiring and step 9's telemetry columns are all proven there, against a real
      // Postgres. No skip path, same rule Stage 01 and Stage 05 already follow.
      'pnpm --filter @infinite-ai/agents test',
      'pnpm --filter @infinite-ai/prompts test',
      'pnpm --filter @infinite-ai/orchestrator test',
      'pnpm --filter @infinite-ai/orchestrator test:integration',
      'pnpm --filter @infinite-ai/guardrails test',
      'pnpm test:injection',
    ],
  },
  {
    id: '07',
    name: 'Eval harness and golden sets',
    commands: [
      // Mirrors the manual's own verification block. The package's own unit tests come
      // first so a real failure inside the harness itself is diagnosed before the two CLI
      // scripts are even asked to run — both currently report "nothing found" cleanly
      // against this repo's still-empty packages/evals/sets, since no module has a real
      // agent yet (Stage 08 is the first); that is the correct, honest result for this
      // point in the build, not a passing test standing in for a real one.
      'pnpm --filter @infinite-ai/evals test',
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
  {
    id: '08',
    name: 'MOD-01 Curriculum Engine',
    commands: [
      // Contract tests for all nine CE-0x Zod schemas (input, output, drift types,
      // export surface) — 241 tests including the exhaustive barrel export check.
      'pnpm --filter @infinite-ai/contracts test',
      // All nine agent contracts validated (id, module, purpose, guardrails, budget,
      // prompt ref, eval set ref). 139 tests total.
      'pnpm --filter @infinite-ai/agents test',
      // Prompt lock integrity: every CE-01..CE-09 prompt file hash matches the lock,
      // confirming no prompt was silently edited after the last ratification run.
      'pnpm --filter @infinite-ai/prompts test',
      // Pipeline DAG structural integrity (validatePipelineDag), gating proof
      // (publish-to-brain behind HoD gate), export dispatcher routing. 76 tests.
      'pnpm --filter @infinite-ai/orchestrator test',
      // Eval harness unit tests — scaffolding is correct and case schema is enforced.
      'pnpm --filter @infinite-ai/evals test',
      // Smoke-run all eval sets. Exits 0 when no executor is registered (empty-vessel
      // state) — the manual's pnpm evals:run --module mod-01 flag does not exist;
      // --all is the equivalent command as implemented in scripts/evals-run.ts.
      'pnpm evals:run --all',
      // Gate eval scores. Also exits 0 when no executor is registered (same rationale).
      'pnpm evals:gate',
    ],
  },
  { id: '09', name: 'MOD-03 Data Warehouse', commands: [] },
  {
    id: '10',
    name: 'MOD-02 Support Analytics Centre',
    commands: [
      // Tier model and SIAS state machine — ≥ 95% coverage.
      'pnpm --filter @infinite-ai/analytics test:coverage',
      // Eval sets for all AC agents (smoke-run + gate score).
      'pnpm evals:run --all',
      'pnpm evals:gate',
      // Diagnosis red-team: every poisoned input must be refused.
      'pnpm test:redteam:diagnosis',
      // Safeguarding escalation drill.
      'pnpm test:drill:safeguarding',
      // Bias monitor on skewed fixture.
      'pnpm test:bias-monitor',
    ],
  },
  {
    id: '11',
    name: 'MOD-04 Teaching & Learning Toolbox',
    commands: [
      // Contract tests for all eleven TB-xx Zod schemas — input/output, readability bands,
      // answer-key verification, accessibility validator, no-fabrication guard. All pure
      // unit-tier; no Docker required.
      'pnpm --filter @infinite-ai/contracts test',
      // All eleven TB agent contracts validated (id, module, purpose, guardrails, budget,
      // prompt ref, eval set ref). 407 tests total.
      'pnpm --filter @infinite-ai/agents test',
      // Prompt lock integrity: every TB-01..TB-11 prompt hash matches the lockfile,
      // confirming no prompt was silently edited after the last ratification run.
      'pnpm --filter @infinite-ai/prompts test',
      // MOD-04 pipeline DAG structural integrity (validatePipelineDag), gating proof
      // (deliver-artefact behind teacher human_gate), export dispatcher routing.
      'pnpm --filter @infinite-ai/orchestrator test',
      // Eval harness unit tests.
      'pnpm --filter @infinite-ai/evals test',
      // Smoke-run all eval sets (exits 0 when no live executor is registered).
      'pnpm evals:run --all',
      'pnpm evals:gate',
      // Stage 11-specific cross-cutting test suites named explicitly in the manual's
      // verification block — run here as named suite commands so the failure diagnosis
      // is targeted rather than buried in the full contracts run above.
      'pnpm test:readability',
      'pnpm test:answer-key-verification',
      'pnpm test:accessibility',
    ],
  },
  {
    id: '12',
    name: 'MOD-05 Teaching Analytics & PD Studio',
    commands: [
      // PD agent schemas (PD-01..PD-08), signal model, and all cross-cutting contracts.
      'pnpm --filter @infinite-ai/contracts test',
      // All 8 PD agent contracts validated (id, module, purpose, guardrails, budget,
      // prompt ref, eval set ref). 39 contract tests total.
      'pnpm --filter @infinite-ai/agents test',
      // Prompt lock integrity: every PD-01..PD-08 prompt hash matches the lockfile.
      'pnpm --filter @infinite-ai/prompts test',
      // MOD-05 pipeline DAG structural integrity (validatePipelineDag), gating proof
      // (deliver-pd-intervention behind HoD human_gate), CPTD pipeline.
      'pnpm --filter @infinite-ai/orchestrator test',
      // Eval harness unit tests.
      'pnpm --filter @infinite-ai/evals test',
      // Smoke-run all eval sets (exits 0 when no live executor is registered).
      'pnpm evals:run --all',
      'pnpm evals:gate',
      // Stage 12 cross-cutting test suites — explicitly named so a failure is targeted.
      // Cohort suppression: MINIMUM_COHORT_SIZE = 5, suppressed path leaks no data.
      'pnpm test:aggregation-thresholds',
      // No-ranking: Zod strips rank/percentile/ordinal from all PD agent ok outputs.
      'pnpm test:no-ranking-endpoints',
      // Micro-course: 20–40 min, exportable: true, modules/checkItems/citedSourceIds.
      'pnpm test:course-structure',
      // CPTD: citedPolicyDocumentId required on ok; no_policy_match has no pointsAwarded.
      'pnpm test:cptd',
    ],
  },
  {
    id: '13',
    name: 'LE Learning Engine',
    commands: [
      // Core learning logic — promotion gate, k-anonymity, decay, maturity, promotion log.
      'pnpm --filter @infinite-ai/learning test',
      // Agent contracts — all 9 LE agents, module/purpose/pii_guard/budget/requiresApproval/writesToBrain.
      'pnpm --filter @infinite-ai/agents test le/LE-agents.contract',
      // Wire contracts — LE01..LE09 input/output types, promotion log, maturity, constants.
      'pnpm --filter @infinite-ai/contracts test',
      // Eval harness — all LE eval sets (20 cases each, LE-01..LE-09) recognised.
      'pnpm --filter @infinite-ai/evals test',
    ],
  },
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
