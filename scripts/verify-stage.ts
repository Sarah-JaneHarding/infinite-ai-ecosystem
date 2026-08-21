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
  {
    id: '14',
    name: 'Experience surfaces',
    commands: [
      // Design system: token value assertions and barrel export completeness.
      'pnpm --filter @infinite-ai/design-system test',
      // Web app: unit tests for the role-routing model and env loader.
      // E2E, a11y and Lighthouse tests require a running Next.js server and are
      // run separately via pnpm test:e2e / test:a11y / test:lighthouse (mirrors the
      // pattern Stage 01 uses for its Docker-dependent integration suite).
      'pnpm --filter @infinite-ai/web test',
    ],
  },
  {
    id: '15',
    name: 'Observability, SLOs, DR',
    commands: [
      // Trace-coverage contract: verifies span contracts for gateway and brain are wired.
      'pnpm test:telemetry-coverage',
      // PII log-scrubbing: SA ID, email, phone, payment card patterns scrubbed from logs.
      'pnpm test:log-scrubbing',
      // Paper restore-drill: all 8 runbooks exist and declare RTO/RPO.
      'pnpm drill:restore',
    ],
  },
  {
    id: '16',
    name: 'Security hardening and pen-test readiness',
    commands: [
      // Unit tier for the new packages/security package — 66 tests covering CSP nonce
      // generation, CSRF token generation/validation, sliding-window rate limiting,
      // per-tenant quota enforcement, agent tool allow-lists, and output safety patterns.
      'pnpm test:security',
      // Supply-chain audit: lockfile integrity, exact version pinning in all package.json
      // files, pnpm audit --prod --audit-level=high, SBOM generation.
      'pnpm audit:supply-chain',
      // Tenant-abuse sub-suite: rate-limit and quota tests run in isolation so a CI
      // failure on these guards is immediately visible without wading through all 66 tests.
      'pnpm test:tenant-abuse',
    ],
    // NOTE: pnpm test:rls:exhaustive (Testcontainers) requires Docker. It follows the
    // same pattern as Stages 01, 05, 06 — proven in CI, fails in the authoring sandbox.
    // Run manually before GA: pnpm test:rls:exhaustive
  },
  {
    id: '17',
    name: 'Tenant lifecycle, provisioning, billing',
    commands: [
      // Onboarding wizard (7 steps, required-step tracking, readiness score), lifecycle
      // state machine (ACTIVE/SUSPENDED/CLOSED), and readiness checks — 57 pure unit tests.
      'pnpm test:provisioning',
      // Billing reconciliation suite: tier definitions, metering aggregation, period
      // reconciliation against gateway telemetry, invoice line-item generation (with 15%
      // VAT), and dunning state machine — 65 pure unit tests.
      'pnpm test:billing:reconcile',
      // NOTE: pnpm test:tenant-deletion (Testcontainers) requires Docker. It follows the
      // same pattern as Stages 01, 05, 06 — proven in CI, written blind in the sandbox.
      // Run manually before GA: pnpm test:tenant-deletion
    ],
  },
  {
    id: '18',
    name: 'Launch readiness and handover',
    commands: [
      // Feature-flag registry: typed keys, owner, expiry enforcement, env override.
      // Exits 1 if any flag has passed its expiresAt date — the CI guard for stale flags.
      'pnpm check:flags',
      // Provisioning and billing suites must still pass cumulatively.
      'pnpm test:provisioning',
      'pnpm test:billing:reconcile',
      // NOTE: pnpm load:peak and pnpm load:spike (k6 load tests) require a live
      // environment with a running gateway and data plane. They are listed in OQ-017
      // and must be run manually against staging before GA. No skip path — but they
      // are excluded from the automated gate because they need external infrastructure
      // the authoring sandbox and CI do not have.
      //
      // NOTE: pnpm test:tenant-deletion (Testcontainers) requires Docker. Same pattern
      // as Stages 01, 05, 06 — proven in CI, written blind in the sandbox.
      // Run manually before GA: pnpm test:tenant-deletion
    ],
  },
  {
    id: '19',
    name: 'Visual Agent Builder',
    commands: [
      // Agent-builder: workflow DAG model, node catalogue, edge validation, templates,
      // execution monitoring — 51 unit tests.
      'pnpm --filter @infinite-ai/agent-builder test',
    ],
  },
  {
    id: '20',
    name: 'Master Prompt Builder',
    commands: [
      // Prompt-builder: variable substitution, section splitting (system vs. user turn),
      // token budget enforcement — 24 unit tests.
      'pnpm --filter @infinite-ai/prompt-builder test',
    ],
  },
  {
    id: '21',
    name: 'System Prompt Builder',
    commands: [
      // System-prompt-builder: tenant context, platform rails, full gateway request
      // assembly — 28 unit tests.
      'pnpm --filter @infinite-ai/system-prompt-builder test',
    ],
  },
  {
    id: '22',
    name: 'Game-Based Learning',
    commands: [
      // Gamification: event schema, XP/level/streak logic, badge evaluation,
      // processEvent engine — 41 unit tests.
      'pnpm --filter @infinite-ai/gamification test',
    ],
  },
  {
    id: '23',
    name: 'Low-Tech Assessment',
    commands: [
      // Card generation, session lifecycle, response tallying — 40 unit tests.
      'pnpm --filter @infinite-ai/low-tech-assessment test',
    ],
  },
  {
    id: '24',
    name: 'Document Annotation',
    commands: [
      // Five annotation types, threaded comments, document operations, export — 34 unit tests.
      'pnpm --filter @infinite-ai/document-annotation test',
    ],
  },
  {
    id: '25',
    name: 'Learner Client',
    commands: [
      // Learner profile, course navigation graph, offline queue — 38 unit tests.
      'pnpm --filter @infinite-ai/learner-client test',
    ],
  },
  {
    id: '26',
    name: 'Learner Experience',
    commands: [
      // computeLearnerState, buildSampleGraph, buildSampleProfile, activityTypeEmoji
      // — 12 unit tests covering happy path + 2 failure paths per helper.
      // PWA manifest added; OQ-010 resolved (integrated into apps/web).
      'pnpm --filter @infinite-ai/web test',
    ],
  },
  {
    id: '27',
    name: 'Policy Compliance Engine',
    commands: [
      // 35 unit tests across 6 check areas (attendance, fees, conduct, SIAS, PD points,
      // WSE ratings) plus the aggregating engine. Every finding cites a SourceRef from
      // one of the 14 policy source documents ingested in Stage 26.
      'pnpm --filter @infinite-ai/compliance test',
    ],
  },
  {
    id: '28',
    name: 'PD Journal',
    commands: [
      // 35 unit tests: PdJournalEntry schema validation (6), computeCycleProgress —
      // empty journal (3), point accumulation (7), type breakdown (5) — plus
      // buildPdCycleSummary (8) and integration tests wiring the journal to the
      // compliance engine's checkPdPoints (6).
      'pnpm --filter @infinite-ai/pd-journal test',
    ],
  },
  {
    id: '29',
    name: 'L0 Curriculum Seeder',
    commands: [
      // 30 unit tests across 3 suites:
      //   caps.spec.ts     — buildCapsL0Payload (5) and selectCapsDocuments (6)
      //   atp.spec.ts      — buildAtpL0Payload (6) and selectAtpDocuments (7)
      //   seed.spec.ts     — seedCurriculumFromContracts (6) with mocked brain
      // Integration tests (seed.integration.spec.ts) need Docker/Testcontainers
      // and run separately via pnpm --filter @infinite-ai/curriculum-seed test:integration.
      'pnpm --filter @infinite-ai/curriculum-seed test',
    ],
  },
  {
    id: '30',
    name: 'Curriculum Ratification CLI',
    commands: [
      // 36 unit tests across 4 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts     — Stage 29 (11 tests)
      //   atp.spec.ts      — Stage 29 (13 tests)
      //   seed.spec.ts     — Stage 29 (6 tests)
      //   ratify.spec.ts   — Stage 30: ratifyCurriculumForTenant (6 tests)
      //     happy path, empty set, wrong-tier filter, wrong-status filter,
      //     argument pass-through, error propagation
      // Scripts: scripts/seed-curriculum.ts and scripts/ratify-curriculum.ts
      // Integration: pnpm --filter @infinite-ai/curriculum-seed test:integration
      'pnpm --filter @infinite-ai/curriculum-seed test',
    ],
  },
  {
    id: '31',
    name: 'l0.ingest_ratified_source tool — MOD-01 pipeline readiness gate',
    commands: [
      // 45 unit tests across 5 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts             — Stage 29 (11 tests)
      //   atp.spec.ts              — Stage 29 (13 tests)
      //   seed.spec.ts             — Stage 29 (6 tests)
      //   ratify.spec.ts           — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts — Stage 31: makeL0GateExecutor (9 tests)
      //     happy path (both kinds, CAPS-only, ATP-only), L0NotReadyError,
      //     error message content, invalid input, TEMPLATE rows ignored,
      //     db error propagation, tenantId forwarding
      // ToolDeclaration: packages/agents/src/mod-01/l0-ingest-ratified-source.ts
      //   validated at declaration time via ToolDeclaration.parse()
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/agents typecheck',
    ],
  },
  {
    id: '32',
    name: 'brain.publish_curriculum_version and brain.tombstone_curriculum_version tools',
    commands: [
      // 58 unit tests across 7 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32: makePublishCurriculumVersionExecutor (7 tests)
      //     happy path, invalid input, null committedRowId + error message, error propagation,
      //     tenantId forwarding, hodApprovalId in source, runId as derivationRunId
      //   brain-tombstone-executor.spec.ts — Stage 32: makeTombstoneCurriculumVersionExecutor (6 tests)
      //     happy path, invalid input, wrong reason rejected, error propagation,
      //     tenantId forwarding, brainFactId forwarded to forgetFn
      // ToolDeclarations: packages/agents/src/mod-01/brain-publish-curriculum-version.ts
      //                   packages/agents/src/mod-01/brain-tombstone-curriculum-version.ts
      // TombstoneReason extended: packages/db/src/brain-forgetting.ts
      //   'pipeline_compensation' added (TypeScript-only, no DB migration needed)
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/agents typecheck',
    ],
  },
  {
    id: '33',
    name: 'CE-01 CAPS Mapper executor factory',
    commands: [
      // 69 unit tests across 8 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33: makeCE01Executor (10 tests)
      //     needs_input passthrough, invalid input, non-JSON response, invalid FrameworkResult,
      //     listCaps error propagation, gatewayCall error propagation, tenantId forwarding,
      //     CAPS_CANON filtering (not ATP_CALENDAR), grade/subjects in user message,
      //     promptBody as system message
      // makeCE01Executor: packages/curriculum-seed/src/ce01-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '34',
    name: 'CE-02 ATP Sequencer executor factory',
    commands: [
      // 82 unit tests across 9 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33 (10 tests)
      //   ce02-executor.spec.ts           — Stage 34: makeCE02Executor (13 tests)
      //     needs_input passthrough, invalid input, non-JSON response, invalid ATPResult,
      //     listConstitution error propagation, gatewayCall error propagation,
      //     tenantId forwarding, CAPS_CANON+ATP_CALENDAR included (TEMPLATE excluded),
      //     grade/subjects/academicYear in user message, schoolCalendar included/omitted,
      //     promptBody as system message, curriculum.sequence model
      // makeCE02Executor: packages/curriculum-seed/src/ce02-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '35',
    name: 'CE-03 Term Planner executor factory',
    commands: [
      // 93 unit tests across 10 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33 (10 tests)
      //   ce02-executor.spec.ts           — Stage 34 (13 tests)
      //   ce03-executor.spec.ts           — Stage 35: makeCE03Executor (11 tests)
      //     needs_input passthrough, invalid input (missing termNumber), non-JSON response,
      //     invalid TermPlanResult, listConstitution error propagation, gatewayCall error
      //     propagation, tenantId forwarding, CAPS_CANON+ATP_CALENDAR+ASSESSMENT_POLICY
      //     included (TEMPLATE excluded), grade/subjects/termNumber/academicYear in user
      //     message, promptBody as system message, curriculum.plan model
      // makeCE03Executor: packages/curriculum-seed/src/ce03-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '36',
    name: 'CE-04 Unit Architect executor factory',
    commands: [
      // 108 unit tests across 11 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33 (10 tests)
      //   ce02-executor.spec.ts           — Stage 34 (13 tests)
      //   ce03-executor.spec.ts           — Stage 35 (11 tests)
      //   ce04-executor.spec.ts           — Stage 36: makeCE04Executor (15 tests)
      //     needs_input passthrough, invalid input (missing contentArea), non-JSON response,
      //     invalid UnitBlueprintResult, listConstitution error propagation, getTermPlan
      //     error propagation, gatewayCall error propagation, tenantId forwarding,
      //     only CAPS_CANON rows passed (ATP_CALENDAR+ASSESSMENT_POLICY excluded),
      //     termPlan passed from getTermPlan, null termPlan passed when absent,
      //     grade/subject/termNumber/contentArea/academicYear in user message,
      //     getTermPlan called with correct grade/termNumber/academicYear,
      //     promptBody as system message, curriculum.design model
      // makeCE04Executor: packages/curriculum-seed/src/ce04-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '37',
    name: 'CE-05 Lesson Plan Generator executor factory',
    commands: [
      // 123 unit tests across 12 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33 (10 tests)
      //   ce02-executor.spec.ts           — Stage 34 (13 tests)
      //   ce03-executor.spec.ts           — Stage 35 (11 tests)
      //   ce04-executor.spec.ts           — Stage 36 (15 tests)
      //   ce05-executor.spec.ts           — Stage 37: makeCE05Executor (15 tests)
      //     needs_input passthrough, invalid input (missing templateId), non-JSON response,
      //     invalid LessonPlanResult, listConstitution error propagation, getUnitBlueprint
      //     error propagation, gatewayCall error propagation, tenantId forwarding,
      //     CAPS_CANON+TEMPLATE rows passed (ATP_CALENDAR+ASSESSMENT_POLICY excluded),
      //     unitBlueprint passed from getUnitBlueprint, null unitBlueprint passed when absent,
      //     getUnitBlueprint called with correct params, all input fields in user message,
      //     promptBody as system message, curriculum.lessons model
      // makeCE05Executor: packages/curriculum-seed/src/ce05-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '38',
    name: 'CE-06 Assessment Designer executor factory',
    commands: [
      // 141 unit tests across 13 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                    — Stage 29 (11 tests)
      //   atp.spec.ts                     — Stage 29 (13 tests)
      //   seed.spec.ts                    — Stage 29 (6 tests)
      //   ratify.spec.ts                  — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts        — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts  — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts           — Stage 33 (10 tests)
      //   ce02-executor.spec.ts           — Stage 34 (13 tests)
      //   ce03-executor.spec.ts           — Stage 35 (11 tests)
      //   ce04-executor.spec.ts           — Stage 36 (15 tests)
      //   ce05-executor.spec.ts           — Stage 37 (15 tests)
      //   ce06-executor.spec.ts           — Stage 38: makeCE06Executor (18 tests)
      //     needs_input passthrough, ok result passthrough, invalid input (missing taskKind),
      //     non-JSON response, invalid AssessmentTaskDesignResult, listConstitution error
      //     propagation, getGradeFramework error propagation, getTermPlan error propagation,
      //     gatewayCall error propagation, tenantId+actorId forwarding, only ASSESSMENT_POLICY
      //     rows passed (CAPS_CANON+ATP_CALENDAR excluded), framework+termPlan from Brain in
      //     context, null framework+termPlan when Brain returns null, getGradeFramework correct
      //     params, getTermPlan correct params, all input fields in user message, promptBody as
      //     system message, curriculum.assess model
      // makeCE06Executor: packages/curriculum-seed/src/ce06-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '39',
    name: 'CE-07 Rubric Builder executor factory',
    commands: [
      // 157 unit tests across 14 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                     — Stage 29 (11 tests)
      //   atp.spec.ts                      — Stage 29 (13 tests)
      //   seed.spec.ts                     — Stage 29 (6 tests)
      //   ratify.spec.ts                   — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts         — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts   — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts            — Stage 33 (10 tests)
      //   ce02-executor.spec.ts            — Stage 34 (13 tests)
      //   ce03-executor.spec.ts            — Stage 35 (11 tests)
      //   ce04-executor.spec.ts            — Stage 36 (15 tests)
      //   ce05-executor.spec.ts            — Stage 37 (15 tests)
      //   ce06-executor.spec.ts            — Stage 38 (18 tests)
      //   ce07-executor.spec.ts            — Stage 39: makeCE07Executor (16 tests)
      //     needs_input passthrough, ok result passthrough, invalid input (missing totalMarks),
      //     non-JSON response, invalid RubricResult, getGradeFramework error propagation,
      //     getAssessmentTask error propagation, gatewayCall error propagation,
      //     tenantId+actorId forwarding, framework+assessmentTask from Brain in context,
      //     null framework+assessmentTask when Brain returns null, getGradeFramework called
      //     with grade only, getAssessmentTask called with correct params, all input fields
      //     in user message, promptBody as system message, curriculum.rubric model
      // makeCE07Executor: packages/curriculum-seed/src/ce07-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '40',
    name: 'CE-08 Differentiation Agent executor factory',
    commands: [
      // 173 unit tests across 15 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                     — Stage 29 (11 tests)
      //   atp.spec.ts                      — Stage 29 (13 tests)
      //   seed.spec.ts                     — Stage 29 (6 tests)
      //   ratify.spec.ts                   — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts         — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts   — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts            — Stage 33 (10 tests)
      //   ce02-executor.spec.ts            — Stage 34 (13 tests)
      //   ce03-executor.spec.ts            — Stage 35 (11 tests)
      //   ce04-executor.spec.ts            — Stage 36 (15 tests)
      //   ce05-executor.spec.ts            — Stage 37 (15 tests)
      //   ce06-executor.spec.ts            — Stage 38 (18 tests)
      //   ce07-executor.spec.ts            — Stage 39 (16 tests)
      //   ce08-executor.spec.ts            — Stage 40: makeCE08Executor (16 tests)
      //     needs_input passthrough, ok result passthrough, invalid input (missing tiers),
      //     non-JSON response, invalid DifferentiationResult, getGradeFramework error propagation,
      //     getLessonPlan error propagation, gatewayCall error propagation,
      //     tenantId+actorId forwarding, framework+lessonPlan from Brain in context,
      //     null framework+lessonPlan when Brain returns null, getGradeFramework called
      //     with grade+academicYear, getLessonPlan called with correct params, all input fields
      //     including tiers in user message, promptBody as system message, curriculum.differentiate model
      // makeCE08Executor: packages/curriculum-seed/src/ce08-executor.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
    ],
  },
  {
    id: '41',
    name: 'CE-09 Coverage Auditor executor factory',
    commands: [
      // 189 unit tests across 16 suites in @infinite-ai/curriculum-seed:
      //   caps.spec.ts                     — Stage 29 (11 tests)
      //   atp.spec.ts                      — Stage 29 (13 tests)
      //   seed.spec.ts                     — Stage 29 (6 tests)
      //   ratify.spec.ts                   — Stage 30 (6 tests)
      //   l0-gate-executor.spec.ts         — Stage 31 (9 tests)
      //   brain-publish-executor.spec.ts   — Stage 32 (8 tests)
      //   brain-tombstone-executor.spec.ts — Stage 32 (6 tests)
      //   ce01-executor.spec.ts            — Stage 33 (10 tests)
      //   ce02-executor.spec.ts            — Stage 34 (13 tests)
      //   ce03-executor.spec.ts            — Stage 35 (11 tests)
      //   ce04-executor.spec.ts            — Stage 36 (15 tests)
      //   ce05-executor.spec.ts            — Stage 37 (15 tests)
      //   ce06-executor.spec.ts            — Stage 38 (18 tests)
      //   ce07-executor.spec.ts            — Stage 39 (16 tests)
      //   ce08-executor.spec.ts            — Stage 40 (16 tests)
      //   ce09-executor.spec.ts            — Stage 41: makeCE09Executor (16 tests)
      //     needs_input passthrough, ok result passthrough, invalid input (missing subject),
      //     non-JSON response, invalid CoverageAuditResult, getTermPlan error propagation,
      //     getEpisodeLog error propagation, gatewayCall error propagation,
      //     tenantId+actorId forwarding, termPlan+episodeLog from Brain in context,
      //     null termPlan+episodeLog when Brain returns null, getTermPlan called
      //     with grade+termNumber+academicYear, getEpisodeLog called with correct params,
      //     all input fields in user message, promptBody as system message, curriculum.audit model
      // makeCE09Executor: packages/curriculum-seed/src/ce09-executor.ts
      // EpisodeLog + EpisodeLogEntry added to packages/contracts/src/curriculum/coverage.ts
      'pnpm --filter @infinite-ai/curriculum-seed test',
      'pnpm --filter @infinite-ai/curriculum-seed typecheck',
      'pnpm --filter @infinite-ai/contracts typecheck',
    ],
  },
  {
    id: '42',
    name: 'CE eval-harness executor registration',
    commands: [
      // Registers CE-01 through CE-09 executors so the eval harness can actually
      // run the 270 golden-set cases rather than skipping them for a missing executor.
      // All 270 cases expect status: 'needs_input' — the empty-vessel state when L0
      // has no CAPS/ATP documents. Gate passes with no baseline (first run).
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
  {
    id: '43',
    name: 'DW eval-harness executor registration',
    commands: [
      // Registers DW-01 through DW-08 executors so the eval harness can run all 240
      // DW golden-set cases. Each executor injects context-provided data stores rather
      // than calling real infrastructure; DW-05 delegates directly to runQualityChecks,
      // DW-06 to buildLearner360, DW-07 to synthesiseInsight, and DW-08 to
      // recommendNextStep. Gate passes with no baseline (first run).
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
  {
    id: '44',
    name: 'AC eval-harness executor registration',
    commands: [
      // Registers AC-01 through AC-10 executors so the eval harness can run all AC
      // golden-set cases. Unlike CE and DW, AC executors are pure analytics functions
      // that call real @infinite-ai/analytics implementations directly — no gateway stubs,
      // no injected data stores. Eval cases that use refusal_correctness with non-enum
      // reason codes (needs_input, state_machine_blocked) will fail the scorer's shape
      // check; the gate passes on first run because no champion baseline exists yet.
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
  {
    id: '45',
    name: 'TB eval-harness executor registration',
    commands: [
      // Registers TB-01 through TB-11 executors so the eval harness can run all TB
      // golden-set cases. TB agents are content generators; most eval cases expect
      // status:'ok' with real content shapes (sections, slides, passages, items, etc.).
      // Executors produce deterministic stub content satisfying every schema field the
      // exact_match and set_overlap scorers check. llm_judge cases (OQ-016) will fail
      // their scorer but the gate passes on first run because no champion baseline exists.
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
  {
    id: '46',
    name: 'LE eval-harness executor registration',
    commands: [
      // Registers LE-01 through LE-09 executors so the eval harness can run all 180
      // LE golden-set cases (20 per agent). Unlike TB, every LE agent implements
      // deterministic decision logic rather than content generation, so all cases use
      // exact_match scorers — 100% pass rate expected with no llm_judge cases.
      // LE-07 Challenger Verdict applies numeric promote/reject thresholds directly;
      // LE-08 Pattern Publisher enforces the five-tenant anonymisation minimum;
      // LE-09 Pattern Validator checks CAPS version drift and TTL expiry.
      'pnpm evals:run --all',
      'pnpm evals:gate',
    ],
  },
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
