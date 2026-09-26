# Changelog

All notable changes to INFINITE-AI are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — the
project is pre-1.0 until Stage 18's exit gate passes and a pilot school is live.

---

## [Unreleased]

### Added

- **Stage 81 — Task 16, batch 1: READMEs for cross-cutting foundation packages**
  - `README.md` for `packages/{config,contracts,security,telemetry,testkit,design-system}`
    — what each package does, where it fits the L0–L8 stack, and how to run its tests.
    First of several batches covering all 34 packages/apps that had none.

- **Stage 80 — Failure-path tests for `packages/system-prompt-builder` (closes Task 15)**
  - `packages/system-prompt-builder/test/system-prompt-builder.spec.ts` (8 new tests):
    `TenantContext`'s `locale`/`province` length bounds, and `RequestMeta` — exported
    for validating untrusted per-call metadata but never `.parse()`d internally,
    including its `provenance.deidentified: z.literal(true)` field, this package's own
    encoding of rule 4's PII-provenance invariant, now proven to actually reject
    `false` rather than being enforced only at compile time.
  - This closes audit Task 15 ("Add failure-path tests to thin packages") across all
    ten packages: `compliance`, `apps/web`, `gamification`, `pd-journal`,
    `school-setup`, `document-annotation`, `learner-client`, `low-tech-assessment`,
    `prompt-builder`, `system-prompt-builder`. Final check: `pnpm typecheck` and
    `pnpm test` both pass across all 53 packages in the monorepo.

- **Stage 79 — Failure-path tests for `packages/prompt-builder`**
  - `packages/prompt-builder/test/prompt-builder.spec.ts` (9 new tests): `VariableName`
    and `PromptBudget` are both exported specifically so a caller can validate untrusted
    input before it reaches the builder, but nothing internal calls `.parse()` on
    either — so neither had a test of its own. Closed: `VariableName`'s lower-snake-case
    regex, and `PromptBudget`'s `int().positive()` constraints on all three fields.

- **Stage 78 — Failure-path tests for `packages/low-tech-assessment`**
  - `packages/low-tech-assessment/test/low-tech-assessment.spec.ts` (8 new tests):
    `ScanResult` and `AssessmentSession` were only ever built through always-valid
    fixture helpers (`makeScan`/`makeSession`) — neither schema had a rejection
    test of its own. Closed: `ScanResult`'s `cardNumber` bound and `CardSide` enum;
    `AssessmentSession`'s empty `sessionId`/`title`, out-of-range `classSize`, and
    empty `questions` array.

- **Stage 77 — Failure-path tests for `packages/learner-client`**
  - `packages/learner-client/test/learner-client.spec.ts` (14 new tests):
    `LearnerProfile`'s empty-identifier constraints, `ActivityNode`'s empty
    `title`/`activityId`, and all three offline-event payload schemas
    (`QuizAnsweredPayload`, `ActivityCompletedPayload`, `AssessmentSubmittedPayload`)
    had zero rejection tests — every prior test built payloads through a fixture
    helper that was always already valid. Also closes `OfflineEvent`'s own
    envelope constraints (empty `eventId`, malformed `occurredAt`).

- **Stage 76 — Failure-path tests for `packages/document-annotation`**
  - `packages/document-annotation/test/document-annotation.spec.ts` (10 new tests):
    `CommentPayload`, `TextBoxPayload`, and `StampPayload` had zero rejection tests
    despite real constraints of their own (`min(1)` body/label, `.positive()`
    width/height) — closed, including a regression test documenting that
    `TextBoxPayload.body` deliberately has no `min(1)` (an empty text box is a valid
    in-progress state). The `Annotation` envelope and `AnnotationReply` schemas'
    own constraints (empty identifiers, malformed `createdAt`) were also untested —
    every prior test exercised business-logic checks instead of the schemas.

- **Stage 75 — Failure-path tests for `packages/school-setup`**
  - `packages/school-setup/src/__tests__/types.spec.ts` (5 new tests): `validateSchoolConfig`
    — `validate.ts`'s one exported function whose whole purpose is safely parsing a raw
    `unknown` value — had zero tests of its own; every existing test called
    `SchoolConfig.parse` directly instead. Now proven to accept valid raw input, reject an
    empty object, `null`, a plain string, and input with a nested schema violation.

- **Stage 74 — Failure-path tests for `packages/pd-journal`**
  - `packages/pd-journal/test/pd-journal.spec.ts` (6 new tests): `resolveCycleYear`'s
    documented clamp to cycle year 3 for a date years past the cycle end — previously
    unreached, since every existing test's `asOf` stopped exactly at the year-3 boundary
    and never went further out. `buildPdCycleSummary`'s re-tagging of each entry's
    `educatorToken` to its journal `Map` key, rather than trusting whatever token the
    entry itself carries, is now proven to correctly override a mismatch — a
    data-attribution-integrity path with no prior test.

- **Stage 73 — Failure-path tests for `packages/gamification`**
  - `packages/gamification/test/schemas.spec.ts` (new, 12 tests): `LearnerGamificationProfile`
    — the input state `processEvent` trusts completely — now has its own constraints
    (non-negative/integer `xp` and `streakDays`, `level` ≥ 1, non-empty `profileId`) proven
    to reject bad data, plus the same for `AssessmentCompletedEvent`, `ModuleCompletedEvent`,
    `GateApprovedEvent`, and the `GamificationEvent` discriminated union (unknown `type`,
    malformed `occurredAt`).
  - `packages/gamification/test/gamification.spec.ts` (4 new tests): `assessment_completed`
    — a real event type and switch case with zero prior coverage — now exercised end-to-end
    through `processEvent`; `streak_30`'s `minLevel: 2` badge gate now proven enforced
    (previously only the self-gating `level_5`/`level_10` badges were tested).

- **Stage 72 — Failure-path tests for `apps/web`**
  - `apps/web/tests/unit/env.spec.ts` (9 new tests): proves `WebEnvSchema` actually
    rejects an under-length `NEXTAUTH_SECRET`, a malformed `NEXTAUTH_URL` or
    `AUTH_KEYCLOAK_ISSUER`, and an out-of-enum `NODE_ENV` — the schema's own validation
    boundary, previously unreached by any test because `getWebEnv()` short-circuits to a
    fixed test object whenever `NODE_ENV==='test'`. Also exercises `getWebEnv()`'s
    production throw-on-invalid-env path directly, via `vi.stubEnv`.
  - `apps/web/tests/unit/roles.spec.ts` (3 new tests): proves `roleCanViewPath` — the
    RBAC gate behind this app's page routing — denies same-prefix path-name collisions
    (`/teacherx` against the allowed `/teacher`, `/approvalsx` against the allowed
    `/approvals`) rather than treating them as nested/allowed paths.

- **Stage 71 — Failure-path tests for `packages/compliance`**
  - `packages/compliance/test/schemas.spec.ts` (new): 23 tests proving the package's
    seven exported Zod input schemas actually reject invalid data (out-of-range
    percentages/quintiles/stages/cycle-years, empty identifier strings) — the package's
    real input-validation boundary, previously untested despite 35 existing tests
    thoroughly covering its business logic.

- **Stage 70 — Mirrored `SECURITY.md` to the repository root**
  - `SECURITY.md` (new, root): a short pointer GitHub's Security tab can find, with the
    "report to the repository owner, not a public issue" instruction stated directly and
    a link to `docs/SECURITY.md` — the single canonical copy — for the full policy.

### Fixed

- **Stage 69 — Approved pnpm native build scripts**
  - `package.json`'s `pnpm.onlyBuiltDependencies`: added `cpu-features`, `ssh2`,
    `protobufjs` (all three transitively required by `testcontainers`, the Docker-backed
    integration-test tooling), and `msgpackr-extract` (required by `bullmq`,
    `apps/worker`'s real job-queue library). Each traced to its actual dependency chain
    and cross-checked against npm registry maintainer metadata before approving — not a
    blind `pnpm approve-builds --all`. Removes the "Ignored build scripts" warning every
    `pnpm install` printed.

### Added

- **Stage 68 — CODEOWNERS and Dependabot**
  - `.github/CODEOWNERS`: path-scoped ownership covering every CLAUDE.md-named
    invariant-enforcing area (`packages/db`, `packages/guardrails`/`packages/deident`,
    `apps/gateway`, `packages/policy`/`packages/contracts/src/popia`), plus
    `packages/security`, `infra/`, `.github/workflows/`, and
    `scripts/verify-stage.ts`. Every handle is a real collaborator (checked via the
    GitHub API first) — no invented teams.
  - `.github/dependabot.yml`: weekly version updates for the whole pnpm workspace (one
    `npm` ecosystem entry, patch/minor grouped) and for third-party GitHub Actions used
    in `.github/workflows/*.yml`.

### Removed

- **Stage 67 — Dead CodeDeploy-to-EC2 scaffolding**
  - `appspec.yml`, `buildspec.yml`, `scripts/restart_server.sh`: deleted. Unmodified
    placeholder boilerplate (Node 18/npm, `/var/www/html`, `systemctl restart nginx`)
    from before this repo settled on its real, single deployment path — Docker → ECR →
    ECS Fargate via `.github/workflows/cd.yml` and `infra/terraform`. Nothing referenced
    any of the three files.

### Fixed

- **Stage 66 — `verify:stage` gate extended through Stage 65**
  - `scripts/verify-stage.ts`: eleven new stage entries (`55`–`65`) closing a gap where
    the cumulative gate script had stopped at id `54` while eleven real stages had
    already shipped — `pnpm verify:stage <NN>` was silently not covering any of them.
  - `.github/workflows/ci.yml`: `Stage gate` step bumped from `pnpm verify:stage 52` to
    `pnpm verify:stage 65` (it had drifted three stages further behind even the script's
    own array).

- **Stage 65 — Terraform module de-duplication (`vpc`/`rds`/`elasticache`)**
  - `infra/terraform/environments/test/main.tf`: rewired onto the same `network`/
    `database`/`cache` modules `modules/stack` uses for dev/staging/production, composed
    directly (no ALB/Langfuse/SES/observability/SNS — not needed for this environment's
    purpose). Fixes a real gap, not just duplicated code: the old `rds` module had no
    role-based access model, so `test` was not proving the tenant-isolation role split
    (`migrator`/`app_rw`/`worker_rw`/`analytics_ro`) rule 5 requires everywhere else.
  - `infra/terraform/modules/{vpc,rds,elasticache}/`: deleted — unreferenced after the
    rewire above.
  - `infra/terraform/README.md`: `test` environment added to the layout list.

### Added

- **Stage 64 — Age-Appropriateness Judge (OQ-015 Gap 2, model-call half)**
  - `packages/prompts/src/AGE-APPROPRIATENESS-JUDGE/1.0.0.prompt.md`: a new Prompt Registry
    entry instructing the judge to render a verdict grounded only in the ratified DBE
    developmental-readiness clauses supplied for each call.
  - `packages/guardrails/src/age-appropriateness-judge.ts`:
    `createGatewayAgeAppropriatenessJudge`, a real `AgeAppropriatenessJudge` that calls the
    Model Gateway and fails closed (`appropriate: false`) on any network error, non-2xx
    response, non-JSON reply, or schema mismatch.
  - `apps/gateway/routing.json`: new `guardrail.age_appropriateness` logical model route.
  - `apps/worker/src/index.ts`: wires the real judge into `ageAppropriatenessCheckerFactory`
    by default for MOD-01/MOD-04 pipeline jobs carrying `gradePhase`.
  - 7 new tests (`packages/guardrails/test/age-appropriateness-judge.spec.ts`) covering the
    happy path, a genuine refusal, and every fail-closed path.
  - Still open: calibration (OQ-016) and the judge's PII-provenance scope — see
    `docs/OPEN_QUESTIONS.md` OQ-015's 2026-09-25 update.

- **Stage 18 — Launch readiness and handover**
  - Feature-flag registry (`packages/config/src/flags.ts`) with typed keys, owner, expiry enforcement and env-override pattern.
  - `pnpm check:flags` CI guard (`scripts/check-feature-flags.ts`) that exits 1 on any expired flag.
  - `CHANGELOG.md` (this file), `OPERATOR_MANUAL.md`, `ONBOARDING_GUIDE.md`, `HOW_TO_ADD_AN_AGENT.md`, `COST_MODEL.md`, `PILOT_PROTOCOL.md`, `INCIDENT_PROCESS.md`, `RUNBOOKS/canary-deploy.md`.
  - Flags: `pilot_school_onboarding_wizard` (default off, expiry extended to 2027-02-01 for pilot evaluation period), `billing_dunning_emails`, `commons_pattern_sharing` (both default off, expiring 2026-11-01/15).

- **OQ-019 — Benjamin Pine Primary School confirmed as pilot school #1 (2026-09-09)**
  - `packages/provisioning/src/pilot.ts`: `PilotTenantConfig` interface, `PilotTenantConfigSchema`, and `PILOT_COHORT` with Benjamin Pine Primary School as the first confirmed entry (small primary, Starter tier, Grades R–7, English LoLT, Term 4 2026 start).
  - `docs/PILOT_PROTOCOL.md` updated with the confirmed cohort table; two slots for schools #2 and #3 remain pending.

- **Stage 17 — Tenant lifecycle, provisioning, billing**
  - Onboarding wizard (7 steps, readiness score).
  - Tenant lifecycle state machine: `ACTIVE → SUSPENDED → CLOSED`.
  - Billing tier model (Starter / Professional / Enterprise) with per-learner and per-artefact pricing.
  - Metering and reconciliation pipeline with 15 % VAT invoicing.
  - Dunning state machine (OVERDUE → SUSPENDED → CLOSED escalation).
  - POPIA-compliant tenant closure: mutable data erased, audit and consent ledgers retained under legal-obligation basis.

- **Stage 16 — Security hardening and pen-test readiness**
  - CSP nonce generation, CSRF double-submit tokens.
  - Sliding-window rate limiting and per-tenant quota enforcement.
  - Agent tool allow-list enforcement and output safety patterns.
  - Supply-chain audit (`pnpm audit:supply-chain`), SBOM in `docs/sbom.json`.

- **Stage 15 — Observability, SLOs, DR**
  - Trace-coverage contracts for gateway and brain.
  - PII log-scrubbing (SA ID, email, phone, payment card patterns).
  - Paper restore-drill against all 8 runbooks.

- **Stage 14 — Experience surfaces**
  - Design system (Tailwind tokens, component library).
  - `apps/web` Next.js application with role-based routing.

- **Stage 13 — LE Learning Engine**
  - Promotion gate (k-anonymity ≥ 5, maturity ≥ 60 %, decay).
  - Pattern sharing to Commons pool (gated behind `commons_pattern_sharing` flag).
  - Nine LE agents (LE-01 through LE-09) with eval sets.

- **Stage 12 — MOD-05 Teaching Analytics & PD Studio**
  - Eight PD agents (PD-01 through PD-08).
  - CPTD points pipeline with `citedPolicyDocumentId` enforcement.
  - Cohort suppression (minimum cohort ≥ 5) and no-ranking policy.

- **Stage 11 — MOD-04 Teaching & Learning Toolbox**
  - Eleven TB agents (TB-01 through TB-11).
  - Readability-band validation, answer-key verification, accessibility checks.

- **Stage 10 — MOD-02 Support Analytics Centre**
  - SIAS tier model and state machine.
  - Safeguarding escalation (paging integration: OQ-014).
  - Bias monitor on skewed fixtures.

- **Stage 09 — MOD-03 Data Collection & Warehouse**
  - Ingest pipeline and domain-event log.
  - Analytics views (de-identified, `analytics_ro` only).

- **Stage 08 — MOD-01 Curriculum Engine**
  - Nine CE agents (CE-01 through CE-09).
  - CAPS alignment graph (source documents: OQ-002, OQ-005).

- **Stage 07 — Eval harness and golden sets**
  - Eval harness with LLM-as-judge scorer (calibration: OQ-016).
  - Schema-validated eval cases, per-module score gates.

- **Stage 06 — Agent runtime, orchestrator, guardrails, HITL**
  - DAG-based pipeline orchestration with human-in-the-loop gates.
  - Durability and resumability via Postgres-backed step runs.
  - Irreversible-tool gating, safeguarding escalation routes.

- **Stage 05 — Infinite Brain (L0–L4)**
  - Five memory tiers: constitution, nodes, edges, embeddings, episodes.
  - Append-only write path, retrieval, temporal decay, conflict queue.

- **Stage 04 — Model Gateway**
  - Single entry-point (`apps/gateway`) for all model calls.
  - Adapter pattern; no provider SDK in application code.
  - Cost budget enforcement and telemetry per call.

- **Stage 03 — POPIA layer**
  - Consent ledger, retention rules, data-subject requests.
  - Purpose limitation table (purpose before consent is deliberate).
  - De-identification service (`packages/deident`).
  - PII guard (provenance-first: `deidentified: true` stamp required).

- **Stage 02 — Identity, RBAC, audit ledger**
  - Role-assignment model, RBAC matrix.
  - Hash-chained audit ledger (append-only, tamper-evident).

- **Stage 01 — Data foundation, tenancy, RLS**
  - Tenant-isolated Prisma client (`withTenant()`).
  - Row-Level Security on every tenant-owned table.
  - RLS isolation suite (Testcontainers, real Postgres).

- **Stage 00 — Ground rules, repository, toolchain**
  - pnpm workspaces + Turborepo monorepo.
  - Strict TypeScript, ESLint flat config enforcing all eleven rules.
  - `packages/config` Zod-validated environment loader.

---

[Unreleased]: https://github.com/Sarah-JaneHarding/infinite-ai-ecosystem/compare/HEAD...HEAD
