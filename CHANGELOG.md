# Changelog

All notable changes to INFINITE-AI are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — the
project is pre-1.0 until Stage 18's exit gate passes and a pilot school is live.

---

## [Unreleased]

### Added

- **Stage 18 — Launch readiness and handover**
  - Feature-flag registry (`packages/config/src/flags.ts`) with typed keys, owner, expiry enforcement and env-override pattern.
  - `pnpm check:flags` CI guard (`scripts/check-feature-flags.ts`) that exits 1 on any expired flag.
  - `CHANGELOG.md` (this file), `OPERATOR_MANUAL.md`, `ONBOARDING_GUIDE.md`, `HOW_TO_ADD_AN_AGENT.md`, `COST_MODEL.md`, `PILOT_PROTOCOL.md`, `INCIDENT_PROCESS.md`, `RUNBOOKS/canary-deploy.md`.
  - Flags: `pilot_school_onboarding_wizard`, `billing_dunning_emails`, `commons_pattern_sharing` (all off by default, expiring 2026-11-01 to 2026-11-15).

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
