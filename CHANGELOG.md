# Changelog

All notable changes to INFINITE-AI are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — the
project is pre-1.0 until Stage 18's exit gate passes and a pilot school is live.

---

## [Unreleased]

### Fixed

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
