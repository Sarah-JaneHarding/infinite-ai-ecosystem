# INFINITE-AI EDUCATION ECOSYSTEM

## Build Manual for Claude Code — End-to-End Development Specification

Version 1.0 · Internal Build Spec · Multi-Tenant SaaS · POPIA / ZA Data Residency

---

# PART 0 — OPERATING CONTRACT FOR CLAUDE CODE

Read this entire part before writing a single line of code. It is binding for the whole build.

## 0.1 What you are building

A multi-tenant SaaS platform sold to South African schools. It has six subsystems that work as one cohesive system:

| ID     | Subsystem                      | Purpose                                                                     |
| ------ | ------------------------------ | --------------------------------------------------------------------------- |
| BRAIN  | Infinite Brain                 | Durable institutional memory (5 tiers) that never loses policy or decisions |
| LE     | Learning Engine                | Makes the Brain more intelligent with use, auditably and reversibly         |
| MOD-01 | Curriculum Engine              | Owns the planning lifecycle: CAPS → ATP → term → unit → lesson → assessment |
| MOD-02 | Support Analytics Centre       | RTI / MTSS mapped onto DBE SIAS: screen, tier, intervene, monitor, report   |
| MOD-03 | Data Collection & Warehouse    | Ingest, conform, de-identify, Learner-360, insight, next step               |
| MOD-04 | Teaching & Learning Toolbox    | Specialist agents that make classroom materials                             |
| MOD-05 | Teaching Analytics & PD Studio | Practice analytics, PD gap detection, short courses on demand               |

Everything runs behind a **guardrail and policy plane**, on a **model gateway**, over a **tenant-isolated data plane**.

## 0.2 The eleven rules you must never break

1. **Never skip a stage, and never start a stage before the previous stage's Exit Gate passes.** The gate is a checklist plus a passing test command. If a gate fails, fix it. Do not proceed "temporarily".
2. **Never disable, skip, delete, or weaken a failing test to make CI green.** Fix the root cause. `.skip`, `.only`, `xit`, commented-out assertions and lowered thresholds are all forbidden in committed code.
3. **No model call may bypass the Model Gateway.** No direct calls to any provider SDK from application code. One exception: the gateway's own provider adapters.
4. **No learner personal information may enter a prompt.** All prompt inputs derived from learner data must pass through the De-identification Service and carry a `deidentified: true` provenance flag. This is enforced by a runtime guard and a test suite; do not add an escape hatch.
5. **Every database read and write goes through the tenant-scoped client.** Postgres Row-Level Security is the second line of defence, not the first. A query that could execute without a tenant context is a security bug.
6. **Human-in-the-loop gates cannot be bypassed in production.** No feature flag, no environment variable, no `SKIP_APPROVAL`. The approval record must exist before the guarded transition commits.
7. **No secret in the repository, ever** — not in code, not in tests, not in fixtures, not in a comment, not in an example `.env`. `.env.example` contains key _names_ with empty values only.
8. **TypeScript is strict.** No `any`, no `@ts-ignore`, no `@ts-expect-error` without an adjacent issue link and a test that proves the narrowing is safe. `unknown` plus a Zod parse is the correct pattern.
9. **No new dependency without recording** name, version, licence, why it is needed, and what it replaces, in `docs/DEPENDENCIES.md`. Reject anything not MIT / Apache-2.0 / BSD / ISC without explicit approval.
10. **No schema change without a forward migration and a tested rollback.** Destructive migrations require a separate, explicitly approved step.
11. **Nothing is destructively updated in the Brain.** Facts are superseded with a new version. Deletion happens only through the retention/tombstone path.

## 0.3 Stop and ask the human

Stop work, write your question into `docs/OPEN_QUESTIONS.md`, and ask, whenever any of these is true:

- A requirement in this manual conflicts with another requirement in this manual.
- A stage requires a credential, tenant, domain, or third-party account you do not have.
- You are about to make an irreversible data operation (drop, truncate, destructive migration, bulk delete).
- You are about to weaken a security or privacy control to make something work.
- A CAPS, ATP, SIAS or SACE rule is ambiguous and you would otherwise guess.
- A required behaviour would need learner PII in a prompt.
- An exit gate cannot be met with the current design and you believe the design must change.
- Estimated cost of a stage exceeds its stated budget by more than 30%.

Do **not** invent curriculum policy, assessment weightings, SIAS process steps or CPTD point values. If it is not in a supplied source document, ask.

## 0.4 Definition of Done — applies to every task

A task is done when **all** of the following are true:

- Code is written in TypeScript strict mode and passes `pnpm lint` and `pnpm typecheck`.
- Unit tests exist for the happy path plus at least two failure paths, and pass.
- If the task touches tenancy, auth, PII, or a guardrail: a dedicated security test exists and passes.
- If the task adds an API surface: a Zod schema defines the contract, and a contract test asserts it.
- If the task adds an agent: it is registered, its prompt is versioned in the Prompt Registry, it has an eval set of at least 20 cases, and a cost budget.
- Observability: the code path emits a trace span and, where relevant, a metric and an audit-ledger entry.
- Documentation: the relevant file under `docs/` is updated in the same commit.
- The stage's cumulative test command still passes (no regressions).

## 0.5 Commit and PR discipline

- Conventional Commits: `feat(mod-01): add ATP sequencer agent`.
- One logical change per commit. Maximum ~400 changed lines per PR excluding generated files, lockfiles and snapshots.
- Every PR body states: stage, task ID, what changed, how it was tested, and which guardrails it touches.
- Never force-push to `main`. Never commit directly to `main`.
- Branch naming: `stage-07/eval-harness`, `fix/rls-leak-in-reports`.

## 0.6 How to work through this manual

For each stage, in order:

1. Read the whole stage before starting.
2. Create a task list from the stage's numbered steps. Do not reorder them.
3. Implement step by step. Commit after each step that leaves the tree green.
4. Run the stage's **Verification** commands.
5. Walk the **Exit Gate** checklist item by item and record the result in `docs/STAGE_LOG.md`.
6. Only then start the next stage.

Record every stage in `docs/STAGE_LOG.md` using this format:

```
## Stage 07 — Eval Harness
Started: 2026-08-03  Completed: 2026-08-06
Exit gate: PASS
Tests: 214 passing, 0 skipped. Coverage 87% lines / 84% branches.
Deviations from manual: none
Open questions raised: OQ-014 (golden set size for TB-06)
```

---

# PART 1 — LOCKED TECHNICAL DECISIONS

Do not substitute any of these without asking. They are chosen for enterprise credibility, self-hostability and South African data residency.

## 1.1 Stack

| Concern                | Choice                                                            | Notes                                          |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Monorepo               | pnpm workspaces + Turborepo                                       | Remote cache off until Stage 15                |
| Language               | TypeScript 5.x, `strict: true`, `noUncheckedIndexedAccess: true`  | Everywhere, including scripts                  |
| Web app                | Next.js (App Router) + React + Server Components                  | One app, role-scoped routes                    |
| API                    | tRPC for first-party clients; REST (OpenAPI 3.1) for integrations | Both share Zod schemas                         |
| Styling                | Tailwind + the INFINITE-AI design tokens                          | Tokens are canonical; no ad-hoc hex values     |
| UI primitives          | shadcn/ui (vendored, not linked)                                  | Restyled to the design system                  |
| Database               | PostgreSQL 16                                                     | RLS on every tenant table                      |
| ORM                    | Prisma                                                            | Plus raw SQL for graph traversal and analytics |
| Vector search          | pgvector with HNSW indexes                                        | Same database, same tenant boundary            |
| Graph                  | Postgres `brain_node` / `brain_edge` tables + recursive CTEs      | Neo4j is a documented later option, not now    |
| Cache / queue          | Redis 7 + BullMQ                                                  | Queues, rate limits, idempotency keys          |
| Pipeline orchestration | In-house DAG runner on BullMQ (Stage 06)                          | Durable, resumable, auditable                  |
| Object storage         | S3-compatible; MinIO in dev, AWS S3 `af-south-1` in prod          | Artefacts, uploads, exports                    |
| Identity               | Keycloak (self-hosted OIDC) + Auth.js on the app side             | SAML and SCIM for enterprise tenants           |
| Model gateway          | Self-hosted OpenAI-compatible proxy (Stage 04)                    | Account pooling, fallback chains, budgets      |
| LLM observability      | Langfuse (self-hosted)                                            | Traces, datasets, scores                       |
| Telemetry              | OpenTelemetry → Grafana (Tempo / Loki / Mimir)                    | One trace ID end to end                        |
| Evals                  | Promptfoo + Langfuse datasets                                     | CI-gated                                       |
| Secrets                | SOPS + age in repo for config; AWS Secrets Manager in prod        | Never plaintext                                |
| Tests                  | Vitest, Playwright, Testcontainers, k6, fast-check                | See Part 7                                     |
| CI/CD                  | GitHub Actions → OIDC → AWS                                       | No long-lived cloud keys                       |
| Infra                  | Docker Compose (dev), Terraform + ECS Fargate or EKS (prod)       | Region `af-south-1`                            |
| Email / messaging      | Transactional email provider + WhatsApp Business API              | Guardian comms                                 |

## 1.2 Repository layout

```
infinite-ai/
  apps/
    web/                     Next.js app — all role surfaces
    worker/                  BullMQ workers, DAG runner host
    gateway/                 Model gateway service
  packages/
    db/                      Prisma schema, migrations, tenant client, RLS tests
    brain/                   Memory service: L0–L4, retrieval, write path
    agents/                  Agent registry, agent implementations
    prompts/                 Prompt Registry: versioned prompt sources + loader
    guardrails/              Input/output validators, refusal policy, PII guard
    orchestrator/            DAG definitions, runner, compensation
    deident/                 De-identification + re-identification service
    policy/                  RBAC, consent, purpose limitation, retention
    contracts/               Zod schemas shared by API, agents, UI
    evals/                   Golden sets, scorers, promptfoo configs
    design-system/           Tokens, components, infinity mark
    telemetry/               OTel setup, audit ledger client
    testkit/                 Test factories, tenant fixtures, seeded scenarios
  infra/
    docker/                  Compose files
    terraform/               Environments
  docs/
    ARCHITECTURE.md  SECURITY.md  POPIA.md  AGENTS.md  PROMPTS.md
    DEPENDENCIES.md  STAGE_LOG.md  OPEN_QUESTIONS.md  RUNBOOKS/
  CLAUDE.md                  Condensed rules — regenerate from Part 0
```

## 1.3 Non-negotiable cross-cutting requirements

- **Tenant isolation**: every tenant-owned row carries `tenant_id`. RLS policy on every such table. No service-role query without an explicit, logged justification.
- **Data residency**: all learner data at rest in `af-south-1`. Model calls that would send de-identified text outside the region require a per-tenant setting, default off, and are logged.
- **Encryption**: TLS 1.3 in transit; AES-256 at rest; application-level encryption for special personal information columns.
- **Audit**: append-only ledger of every read and write of learner data, every agent run, every approval, every prompt/exemplar promotion.
- **Least privilege**: separate DB roles for app, worker, migration, analytics-read.
- **Reversibility**: every automated promotion (prompt, exemplar, playbook) is versioned and one command from rollback.

---

# PART 2 — THE DEVELOPMENT PIPELINE

Nineteen stages. Each has an objective, prerequisites, explicit steps, verification commands and an exit gate. Work them in order.

Stage budget guidance assumes one agent working continuously; treat it as a sanity check, not a deadline.

| Stage | Name                                                               | Depends on |
| ----- | ------------------------------------------------------------------ | ---------- |
| 00    | Ground rules, repo, toolchain                                      | —          |
| 01    | Data foundation, tenancy, RLS                                      | 00         |
| 02    | Identity, RBAC, audit ledger                                       | 01         |
| 03    | POPIA layer: consent, purpose, de-identification, retention        | 01, 02     |
| 04    | Model Gateway                                                      | 00         |
| 05    | Infinite Brain (L0–L4)                                             | 01, 03, 04 |
| 06    | Agent runtime, Prompt Registry, DAG orchestrator, guardrails, HITL | 04, 05     |
| 07    | Eval harness and golden sets                                       | 06         |
| 08    | MOD-01 Curriculum Engine                                           | 06, 07     |
| 09    | MOD-03 Data Warehouse and ingestion                                | 03, 06     |
| 10    | MOD-02 Support Analytics (RTI / MTSS / SIAS)                       | 09         |
| 11    | MOD-04 Teaching & Learning Toolbox                                 | 08, 10     |
| 12    | MOD-05 Teaching Analytics & PD Studio                              | 08, 09, 11 |
| 13    | LE Learning Engine                                                 | 07, 12     |
| 14    | Experience surfaces (role apps)                                    | 08–13      |
| 15    | Observability, SLOs, DR                                            | 14         |
| 16    | Security hardening and pen-test readiness                          | 15         |
| 17    | Tenant lifecycle, provisioning, billing                            | 16         |
| 18    | Launch readiness and handover                                      | 17         |

---

## STAGE 00 — Ground rules, repository, toolchain

**Objective.** A monorepo that builds, lints, type-checks and tests from a clean clone, with the rules of this manual enforced by tooling rather than memory.

**Steps.**

1. Initialise the monorepo: pnpm workspaces, Turborepo, the directory tree from §1.2. Create every package directory with a stub `package.json` and `src/index.ts`.
2. Configure TypeScript: a root `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Every package extends it. No package may relax a compiler option.
3. Configure ESLint with rules that mechanically enforce Part 0: ban `any`, ban `@ts-ignore`, ban `.only`/`.skip` in committed tests, ban direct provider SDK imports outside `apps/gateway`, ban `process.env` access outside `packages/config`.
4. Create `packages/config`: a single Zod-validated environment loader. The app crashes at boot on a missing or malformed variable. Write `.env.example` with names only.
5. Add Prettier, `lint-staged`, and Husky hooks: pre-commit runs lint and typecheck on staged files; pre-push runs the unit suite.
6. Add `docs/` with the files listed in §1.2, each with a real first section, not a placeholder.
7. Generate `CLAUDE.md` at the repo root: a condensed, imperative version of Part 0 §0.2–§0.5 plus the forbidden-pattern list. This is what future sessions read first.
8. Set up GitHub Actions: `ci.yml` running install → lint → typecheck → unit → build on every PR, with a concurrency group and a 15-minute timeout.
9. Add `docs/DEPENDENCIES.md` and record every dependency added in this stage with licence.
10. Add a `scripts/verify-stage.ts` command that takes a stage number and runs that stage's verification set, so gates are reproducible.

**Verification.**

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm verify:stage 00
```

**Exit gate.** All four commands pass from a clean clone. `CLAUDE.md` exists and contains the eleven rules. `.env.example` contains no values. CI is green on a test PR. `docs/STAGE_LOG.md` has a Stage 00 entry.

---

## STAGE 01 — Data foundation, tenancy, Row-Level Security

**Objective.** A Postgres schema where cross-tenant data access is impossible by construction, proven by tests that try to break it.

**Steps.**

1. Stand up Postgres 16 and Redis 7 in `infra/docker/compose.dev.yml`. Enable `pgvector`, `pg_trgm`, `pgcrypto`.
2. Create four database roles: `app_rw`, `worker_rw`, `migrator`, `analytics_ro`. Only `migrator` may DDL. `analytics_ro` gets `SELECT` on de-identified views only.
3. Design the core schema in `packages/db/prisma/schema.prisma`. Minimum tables for this stage:
   - `tenant` (school or school group), `tenant_setting`
   - `user_account`, `role_assignment`
   - `school`, `phase`, `grade`, `class_group`, `subject`, `term`, `academic_year`
   - `learner`, `learner_identifier` (encrypted), `guardian`, `guardian_link`
   - `staff_member`, `teaching_assignment`
   - `audit_event` (append-only)
     Every tenant-owned table has `tenant_id uuid not null`, `created_at`, `updated_at`, `created_by`, and a `version` where mutable.
4. Enable RLS on every tenant-owned table with a policy of the form `tenant_id = current_setting('app.tenant_id')::uuid`, `FORCE ROW LEVEL SECURITY`, and no `BYPASSRLS` on `app_rw` or `worker_rw`.
5. Build the tenant-scoped client in `packages/db/src/client.ts`: a function that opens a transaction, sets `app.tenant_id` and `app.actor_id` as local settings, and yields the Prisma client. Export **only** this. The unscoped client must not be exported from the package's public entry point.
6. Add a compile-time and lint-time guard so no code outside `packages/db` can import the raw Prisma client.
7. Write the **RLS isolation suite** in `packages/db/test/rls.spec.ts` using Testcontainers. It must include, for every tenant-owned table:
   - reading another tenant's row by primary key returns nothing
   - updating another tenant's row affects zero rows
   - inserting a row with a foreign `tenant_id` fails
   - a query with no tenant context set fails loudly rather than returning all rows
   - an aggregate (`count`, `sum`) cannot observe another tenant's rows
8. Add column-level encryption for `learner_identifier` and any special personal information column, with key material from the secrets provider, never from source.
9. Seed script: three tenants with realistically different shapes (a small primary, a large primary, a school group with two campuses), each with grades R–12 where applicable, staff, learners, classes and a term calendar. Seeds must be idempotent.
10. Add `packages/testkit`: factories that always require a tenant, plus a `withTenant()` test helper.

**Verification.**

```bash
pnpm db:migrate:dev && pnpm db:seed
pnpm --filter @infinite-ai/db test          # RLS suite must be 100% green
pnpm verify:stage 01
```

**Exit gate.** Every tenant-owned table appears in the RLS suite (assert this programmatically by comparing the table list from `information_schema` against the tables covered by the test — a table with no test is a failing test). No export path to an unscoped client. Seeds reproducible. Encryption verified by a test that reads the raw column and asserts it is not plaintext.

---

## STAGE 02 — Identity, RBAC, audit ledger

**Objective.** Every actor is authenticated, every action is authorised against an explicit role matrix, and every consequential action is recorded in an append-only ledger.

**Steps.**

1. Deploy Keycloak in dev compose. Create the realm, clients (web, worker, gateway), and the seven base roles: `teacher`, `hod`, `smt`, `sbst`, `admin`, `guardian`, `learner`, plus platform roles `platform_support` and `platform_admin`.
2. Wire Auth.js in `apps/web` against Keycloak OIDC. Sessions are short-lived; refresh is server-side only. Enforce MFA for `admin`, `smt`, `platform_*`.
3. Build `packages/policy/src/rbac.ts`: a declarative permission matrix — resource × action × role × scope (own class / own subject / own school / tenant / platform). Permissions are data, not `if` statements.
4. Implement authorisation as a single `authorize(actor, action, resource)` function used by every tRPC procedure and REST handler. A procedure without an authorisation call must fail a lint rule and a test.
5. Implement the **audit ledger** in `packages/telemetry/src/audit.ts`: append-only, hash-chained (each event stores the hash of the previous event for the tenant), with `actor_id`, `action`, `resource`, `purpose`, `tenant_id`, `trace_id`, `at`, and a JSON diff for writes. Writes go through a dedicated DB role with `INSERT` only.
6. Add a tamper-detection job that walks the hash chain and alerts on a break.
7. Implement `packages/policy/src/impersonation.ts` for support access: time-boxed, reason-required, tenant-approved, loudly banner-flagged in the UI, and always audited.
8. Write the **authorisation matrix test**: a generated test that iterates every role × every permission and asserts allow/deny against a fixture, so a permission change cannot silently widen access.
9. Add negative tests: expired token, wrong tenant in token, role removed mid-session, guardian attempting to read another learner, teacher attempting another class.

**Verification.**

```bash
pnpm --filter @infinite-ai/policy test
pnpm --filter web test:auth
pnpm verify:stage 02
```

**Exit gate.** No route reachable unauthenticated except the health check and the login flow. Authorisation matrix test covers every declared permission. Ledger hash chain verified by test. Impersonation cannot be started without a stored reason and an expiry.

---

## STAGE 03 — POPIA layer: consent, purpose limitation, de-identification, retention

**Objective.** Privacy is enforced by the architecture. It must be impossible to send learner PII to a model, and impossible to use data for a purpose it was not collected for.

**Steps.**

1. Build the **consent ledger** (`packages/policy/src/consent.ts`): per data subject, per data category, per purpose, with lawful basis, source of consent, timestamp, evidence reference, and withdrawal. Consent is versioned and never deleted.
2. Define the **purpose taxonomy** in `packages/contracts`: e.g. `planning`, `screening`, `intervention`, `reporting_parent`, `reporting_district`, `pd_analytics`, `product_improvement`. Each purpose declares the data categories it may touch.
3. Implement **purpose-limited data access**: every query for learner data takes a `purpose` argument. The data layer intersects the requested columns with the purpose's allow-list and the subject's consent, and **drops** disallowed columns rather than failing silently. Log every drop.
4. Build the **De-identification Service** (`packages/deident`):
   - deterministic, tenant-salted tokenisation of identifiers (learner → `LNR_7F3A2C`)
   - free-text scrubbing for names, ID numbers, addresses, phone numbers, school names, using a layered detector (dictionary of tenant-known names → pattern rules → a validation model call) with a documented recall target and a test corpus
   - a re-identification API that requires an authorised role, a purpose, and writes an audit event
   - an output object that carries `{ deidentified: true, salt_version, dropped: [...] }`
5. Build the **PII egress guard** (`packages/guardrails/src/pii-guard.ts`): a mandatory interceptor on the Model Gateway client. It rejects any payload that fails the detector or lacks the de-identification provenance flag. Rejection is a hard error, never a warning.
6. Implement **retention**: a retention schedule per data class, a nightly job that tombstones expired PII, and a `subject_erasure` workflow that (a) tombstones personal data, (b) preserves the decision record with the subject replaced by its token, (c) triggers reindexing, (d) emits an audit event.
7. Implement **data subject rights** endpoints: access, correction, objection, portability export. Each is authorised, audited, and rate-limited.
8. Write `docs/POPIA.md`: purposes, categories, lawful bases, retention periods, cross-border rules, operator/responsible-party split, and the incident procedure.
9. Tests:
   - a fuzz/property test that generates synthetic learner records with PII embedded in free text and asserts the guard blocks 100% of egress attempts
   - a test that a purpose mismatch drops columns and logs
   - a test that consent withdrawal makes the subject's PII unreadable within one job cycle while the decision record survives
   - a red-team test file of at least 40 adversarial prompts attempting to extract PII through an agent; all must fail closed

**Verification.**

```bash
pnpm --filter @infinite-ai/deident test
pnpm --filter @infinite-ai/guardrails test
pnpm test:redteam:pii
pnpm verify:stage 03
```

**Exit gate.** The PII egress guard is on the only code path to the gateway, proven by a test that asserts no other path exists. Red-team suite 100% blocked. Erasure workflow demonstrated end to end on seed data. `docs/POPIA.md` complete.

---

## STAGE 04 — Model Gateway

**Objective.** One self-hosted, OpenAI-compatible egress point for all model traffic, with pooling, fallback, budgets, caching and full observability — so cost is predictable and no provider key ever reaches application code.

**Steps.**

1. Create `apps/gateway`: an HTTP service exposing OpenAI-compatible `/v1/chat/completions` (streaming and non-streaming), `/v1/embeddings`, and a management API.
2. Implement provider adapters behind one internal interface. Support at minimum: an Anthropic-family adapter, an OpenAI-family adapter, and a local/self-hosted small-model adapter for classification and scrubbing work.
3. Implement **credential pooling**: multiple accounts or keys per provider, round-robin with health tracking, automatic cool-down on rate limits, and no credential in logs or traces.
4. Implement **model routing**: a named logical model (e.g. `plan.author`, `screen.classify`, `text.scrub`) maps to an ordered chain of concrete models. On failure or unavailability, fall through the chain. Routing is configuration, not code.
5. Implement **budgets and quotas**: per tenant, per module, per agent, per day and per month. Soft limit warns; hard limit refuses with a typed error the UI can explain. Budgets are enforced before the call, not after.
6. Implement **prompt caching** and **idempotency**: identical (prompt, params, model) within a TTL returns the cached completion, keyed inside the tenant. Idempotency keys prevent duplicate charges on retry.
7. Implement **streaming**, **tool/function calling**, and **structured output** pass-through with schema validation on the way out.
8. Instrument: OTel spans, token counts, latency percentiles, cost estimate, cache hit rate, fallback events, refusal reasons. Ship LLM traces to Langfuse with tenant and agent tags.
9. Enforce the PII guard from Stage 03 as inbound middleware on the gateway itself, so even a mistaken caller cannot leak.
10. Write a **provider-outage drill test**: simulate 429s, 500s, timeouts and truncated streams; assert graceful fallback, no partial writes downstream, and a clear typed error.

**Verification.**

```bash
pnpm --filter gateway test
pnpm --filter gateway test:chaos      # outage and rate-limit drills
pnpm verify:stage 04
```

**Exit gate.** No provider SDK imported outside `apps/gateway` (lint rule plus a repo-wide test). Budget refusal proven by test. Fallback chain proven by test. Zero credentials in logs, proven by a log-scrubbing test. Cache hit path returns identical output and records a hit.

---

## STAGE 05 — Infinite Brain (memory layer L0–L4)

**Objective.** Durable institutional memory. Policy and curriculum canon are immutable and human-ratified; everything the system learns is versioned, provenanced and reversible; personal data expires while decisions do not.

**Steps.**

1. Model the five tiers in `packages/brain`:
   - **L0 Constitution** — school policy, CAPS canon, ATP calendars, templates, assessment policy, POPIA rules, house voice. Immutable, versioned, human-ratified. Table: `brain_constitution` with `version`, `ratified_by`, `ratified_at`, `supersedes`.
   - **L1 Semantic** — `brain_node` (entity), `brain_edge` (typed relation), `brain_embedding` (pgvector). Entity types: learner, class, subject, topic, CAPS code, assessment, intervention, resource, staff member, document.
   - **L2 Episodic** — `brain_episode`: what happened, when, to whom, by whom, with outcome and every human correction. Temporal query support.
   - **L3 Procedural** — prompt versions, pipeline definitions, SOPs, approved exemplars, tool contracts.
   - **L4 Working** — per-run scratchpad in Redis with a TTL, plus a promotion step that writes a summary upward.
2. Implement the **write path** as an explicit state machine: `candidate → extracted+typed → contradiction-checked → provenance-stamped → (ratify if L0/L3) → committed+versioned → indexed → retention-scheduled`. Each transition is persisted so a failed run resumes rather than restarts.
3. Implement **contradiction resolution**: on conflict with an existing fact, compare provenance strength and recency; if the new fact would supersede a human-ratified fact, do not auto-resolve — enqueue a conflict for a human and keep both versions.
4. Implement the **retrieval path** exactly in this order: `query → intent router → policy + RBAC + purpose gate → vector top-k → graph n-hop expansion → episodic temporal filter → rerank → token-budgeted context assembly`. Every stage is individually testable and traced. The policy gate runs _before_ retrieval, never after.
5. Implement **token-budgeted assembly**: a deterministic packer that fills a stated budget by priority (L0 constitution first, then task-relevant L1/L2, then exemplars), records what was included and what was dropped, and never silently truncates mid-fact.
6. Implement **provenance**: every fact stores source, actor, timestamp, confidence, derivation (which agent run produced it) and the trace ID.
7. Implement **never-forget guarantees**: append-only event log for all Brain writes, nightly snapshots with point-in-time restore, an immutable read/write audit trail, and a `brain_conflict_queue`.
8. Implement **forgetting by design**: TTL on personal data per retention class, tombstone on consent withdrawal with reindex, working-memory eviction per run. Policy and curriculum never expire.
9. Build the **Brain API** as typed functions, not free-form SQL: `remember()`, `recall()`, `ratify()`, `supersede()`, `forget()`, `explain()`. `explain()` returns the provenance chain for any retrieved fact — this is what makes the system auditable to a school.
10. Tests:
    - a temporal test: "what did we decide about X in Term 2 last year" returns the version that was current then, not the current one
    - a supersession test: no destructive update anywhere; old versions remain readable
    - a policy-gate test: a teacher cannot retrieve another class's episodes even when semantically relevant
    - a budget test: assembly never exceeds the budget and always includes L0
    - a restore test: point-in-time restore reproduces a known state exactly

**Verification.**

```bash
pnpm --filter @infinite-ai/brain test
pnpm --filter @infinite-ai/brain test:temporal
pnpm verify:stage 05
```

**Exit gate.** Retrieval order enforced by test (a reordered pipeline fails). No code path performs a destructive update on a Brain table (assert via a database trigger that raises on `UPDATE` of superseded rows, plus a test). `explain()` returns a complete chain for every fact type. Restore drill documented in `docs/RUNBOOKS/brain-restore.md`.

---

## STAGE 06 — Agent runtime, Prompt Registry, DAG orchestrator, guardrails, HITL

**Objective.** The machinery every module's agents run on. Nothing module-specific goes in this stage.

**Steps.**

1. **Agent contract.** Define in `packages/agents/src/contract.ts`. Every agent declares: `id`, `version`, `module`, `purpose` (from the taxonomy), `inputSchema` (Zod), `outputSchema` (Zod), `promptRef`, `model` (logical name), `tools`, `guardrails`, `budget`, `evalSetRef`, `requiresApproval`, `writesToBrain`. An agent that omits any field fails to register.
2. **Agent Registry.** A typed registry with a startup validation pass: unknown prompt ref, missing eval set, undeclared purpose, or absent budget is a boot failure, not a warning.
3. **Prompt Registry.** Prompts live in `packages/prompts/src/<agent-id>/<semver>.prompt.md` with front-matter (`agent`, `version`, `model`, `changelog`, `author`, `ratified_by`). The loader is content-hashed; a prompt cannot be edited in place without a version bump (enforced by a test that compares hashes to a lockfile). Prompt structure is mandated in Part 3.
4. **DAG orchestrator.** In `packages/orchestrator`: pipelines are declared as typed DAGs of steps (agent call, tool call, human gate, branch, map-over-collection, compensation). The runner must provide durability (state persisted per step), resumability, idempotency, retries with jitter, per-step timeouts, cancellation, and compensation on failure. A run has one trace ID from start to finish.
5. **Human-in-the-loop gates.** A `human_gate` step creates an approval task with the artefact, a diff against the previous version, the evidence used, and the required role. The run blocks. On approve, reject or edit, the decision, the actor, the reason and any edit diff are recorded — the edit diff is a first-class training signal for Stage 13. Production cannot bypass a gate; assert this with a test that attempts every bypass vector.
6. **Guardrail engine.** In `packages/guardrails`, composable checks running before and after every agent call:
   - input: schema validation, purpose check, consent check, PII guard, prompt-injection detection on any retrieved or user-supplied text, token budget
   - output: schema validation, grounding/citation check (every factual claim must cite a retrieved fact ID or a CAPS clause), template-fidelity check, readability check, age-appropriateness check, refusal-policy check, cost check
   - refusal and escalation: a typed `Refusal` result with a reason code, a user-facing explanation, and an escalation route for safeguarding categories that pages a named human immediately and never queues
7. **Tool registry.** Tools are declared with a Zod schema, a purpose, an idempotency policy and a side-effect classification (`read`, `write`, `external`, `irreversible`). `irreversible` tools always require a human gate.
8. **Cost and rate control.** Per-tenant and per-agent concurrency limits, queue fairness so one large tenant cannot starve others, and a circuit breaker per provider.
9. **Run inspector.** A developer-facing view of any run: DAG, per-step inputs and outputs, retrieved context with provenance, guardrail verdicts, tokens, cost, latency. This is your primary debugging tool for the rest of the build — do not skip it.
10. Tests:
    - a durability test: kill the worker mid-run; on restart the run resumes at the correct step with no duplicated side effects
    - a compensation test: a failing late step rolls back earlier writes
    - a fairness test: a burst from one tenant does not delay another beyond its SLO
    - a bypass test: every attempted HITL bypass fails
    - a prompt-immutability test: editing a prompt without a version bump fails CI
    - an injection test: at least 30 injection payloads embedded in retrieved documents, all neutralised

**Verification.**

```bash
pnpm --filter @infinite-ai/orchestrator test
pnpm --filter @infinite-ai/agents test
pnpm --filter @infinite-ai/guardrails test
pnpm test:injection
pnpm verify:stage 06
```

**Exit gate.** A reference pipeline (three agents, one human gate, one compensation path) runs end to end, survives a worker kill, and is fully inspectable. Registry boot validation rejects a deliberately malformed agent. All guardrail categories implemented and individually tested.

---

## STAGE 07 — Eval harness and golden sets

**Objective.** Quality is measured, not asserted. Build this before any module agent so no agent is ever shipped unmeasured.

**Steps.**

1. Define eval case format in `packages/evals`: `{ id, agentId, input, context, expectations[], rubric, tags[], source }`. `source` records whether the case came from a specification, a real human correction, or an incident.
2. Implement scorers: exact match, JSON-schema conformance, numeric tolerance, set overlap (for topic and code alignment), readability band, template fidelity, citation presence and validity, refusal correctness, and an LLM-as-judge scorer that is itself calibrated against at least 50 human-labelled cases and re-calibrated whenever its own model changes.
3. Implement the runner: run an agent version against a set, produce per-case scores, aggregate metrics, a diff against the current champion, and a cost report.
4. Implement **champion / challenger**: each agent has a champion prompt version. A challenger is promoted only if it (a) beats the champion on the primary metric, (b) regresses no case tagged `must_not_regress`, (c) stays inside budget, and (d) passes a human review gate.
5. Wire CI: on any change to a prompt, agent, guardrail or retrieval code, run the affected eval sets. Fail the build on regression beyond the declared tolerance.
6. Build the **golden set growth loop**: every human rejection or material edit in a HITL gate becomes a candidate eval case, de-identified, reviewed, then added with `source: correction`. This is the mechanism that makes evals track the school's real standard.
7. Add safety evals as a permanent set, run on every change regardless of what changed: PII egress, prompt injection, diagnosis-refusal, age-appropriateness, safeguarding escalation, cross-tenant leakage.
8. Publish an eval dashboard: per agent, score over time, cost over time, champion history.

**Verification.**

```bash
pnpm evals:run --all
pnpm evals:gate            # exits non-zero on regression
pnpm verify:stage 07
```

**Exit gate.** Harness runs the reference pipeline's agents. Champion/challenger promotion proven by test, including a rejected promotion. Safety set wired to run on every change. Judge calibration report committed.

---

## STAGE 08 — MOD-01 Curriculum Engine

**Objective.** The planning lifecycle, end to end, grounded in CAPS and the DBE ATPs, in the school's exact templates, with HoD sign-off and versioning into the Brain.

**Ground the module first.** Before any agent: ingest the supplied CAPS subject statements and ATP files into L0 as ratified constitution. Parse them into a topic graph in L1. If a source document is missing, stop and ask — do not synthesise curriculum.

**Agents to build, in this order.**

| ID    | Agent                 | Output                                                                          |
| ----- | --------------------- | ------------------------------------------------------------------------------- |
| CE-01 | CAPS Mapper           | Topic and skill graph with weightings and cognitive levels                      |
| CE-02 | ATP Sequencer         | Topics laid on the DBE week-by-week calendar, holidays and exam weeks respected |
| CE-03 | Term Planner          | Term plan per subject and grade, including the assessment calendar              |
| CE-04 | Unit Architect        | Backward-design blueprint: big ideas, success criteria, evidence                |
| CE-05 | Lesson Plan Generator | Daily plans in the school's exact template                                      |
| CE-06 | Assessment Designer   | Formal and informal tasks with a controlled cognitive-demand spread             |
| CE-07 | Rubric Builder        | Rubrics and marking memos tied to the task and its CAPS codes                   |
| CE-08 | Differentiation Agent | Tier-aware variants: support, on-level, extension                               |
| CE-09 | Coverage Auditor      | Drift between planned, taught and assessed                                      |

**Pipeline.** `CAPS + ATP ingest → topic graph → term plan → unit blueprint → lesson set + differentiation → assessment + rubric + memo → ◆ HoD approval → publish + version to Brain → coverage audit`.

**Strict parameters to enforce in code, not only in prompts.**

- The CAPS subject statement is the only source of outcomes. An output referencing an outcome with no CAPS clause ID fails the grounding guardrail.
- ATP pacing is authoritative. A deviation requires a stored reason and is surfaced in the coverage audit.
- Template fidelity is structural: validate the rendered artefact against a machine-readable template definition (required sections, order, field names). A mismatch is a hard failure.
- Assessment weightings and mark allocations come from policy in L0. The agent may not compute or invent them.
- Language of learning and teaching follows phase policy from tenant settings.
- No learner personal information in any planning artefact — assert with a test on every artefact type.

**Steps.**

1. Build the machine-readable template definitions for every artefact type the school uses, from the supplied templates. Version them in L0.
2. Build CE-01 and CE-02 first; they produce the structures everything else depends on. Get their eval sets to target before continuing.
3. Build CE-03 → CE-08. For each: contract, prompt, guardrails, eval set of at least 30 cases, cost budget, run inspector check.
4. Build the pipeline in the orchestrator with the HoD gate before publish.
5. Build CE-09 Coverage Auditor as a scheduled job reading L2 episodes against the term plan.
6. Build the export surface: PDF and DOCX in the school's template, plus Google Classroom / Teams / LTI publication.
7. Write `docs/AGENTS.md` entries for all nine agents.

**Verification.**

```bash
pnpm evals:run --module mod-01
pnpm test:e2e --spec curriculum-lifecycle    # ingest -> published lesson set
pnpm test:artefact-fidelity --module mod-01
pnpm verify:stage 08
```

**Exit gate.** A full term of plans for one grade and one subject generated from real CAPS and ATP inputs, approved through the gate, exported in the school's template with no manual fixing, and versioned in the Brain with a complete provenance chain via `explain()`. Coverage audit produces a correct drift report on a deliberately drifted fixture.

---

## STAGE 09 — MOD-03 Data Collection & Warehouse

**Objective.** One reconciled truth per learner, collected from what the school already runs, conformed, consented, de-identified, and turned into insight with an owner and a next step.

**Agents.**

| ID    | Agent                   | Output                                                      |
| ----- | ----------------------- | ----------------------------------------------------------- |
| DW-01 | Ingestion Agent         | Scheduled and event pulls from source systems               |
| DW-02 | Schema Mapper           | Messy source fields mapped to the canonical learner model   |
| DW-03 | Consent Ledger Agent    | Lawful basis and purpose recorded per field                 |
| DW-04 | De-identification Agent | Tokenisation before any model call                          |
| DW-05 | Data Quality Sentinel   | Completeness, duplicates, impossible values, drift          |
| DW-06 | Learner-360 Builder     | One reconciled profile across domains                       |
| DW-07 | Insight Synthesiser     | Narrative insight at learner, class, grade and school level |
| DW-08 | Next-Step Recommender   | The concrete next action, its owner and its date            |

**Pipeline.** `source sync → validate → conform → ◆ consent check → de-identify → Learner-360 → feature store → insight → next step`.

**Steps.**

1. Build the data plane: append-only `event_log`, raw landing zone, conformed warehouse tables, `learner_360` materialisation, and a feature store for screening features. All tenant-scoped, all RLS-covered.
2. Build connectors. Start with a robust file-based connector (CSV/XLSX with a mapping UI) because it always works, then the school information system connector, then screener vendors, then attendance and behaviour sources. Every connector: incremental, idempotent, resumable, with a dead-letter queue and a reconciliation report.
3. Build DW-02 Schema Mapper with a human confirmation step the first time a new source shape is seen; store the mapping in L3 so it is reused thereafter.
4. Build DW-05 Data Quality Sentinel with explicit rules (ranges, referential integrity, duplicate detection by fuzzy match plus human confirmation, distribution drift against the previous term) and a quality score per source per run. Block downstream analytics when the score falls below a threshold rather than producing confident nonsense.
5. Build DW-06 Learner-360 as a deterministic, testable materialisation — no model involved. Models come in at DW-07.
6. Build DW-07 and DW-08. Every insight must carry provenance, confidence and the data it used. An insight that cannot cite its data fails the guardrail.
7. Implement analytics access strictly through de-identified views for `analytics_ro`.
8. Tests: a 10,000-learner synthetic tenant; reconciliation totals match source; a corrupted source is quarantined not ingested; a mid-run failure resumes without duplication; an insight without provenance fails.

**Verification.**

```bash
pnpm --filter @infinite-ai/warehouse test
pnpm test:ingest:reconcile
pnpm evals:run --module mod-03
pnpm verify:stage 09
```

**Exit gate.** Full ingest of a synthetic school reconciles to source totals exactly. Quality gate demonstrably blocks bad data. Every insight in a sample of 50 has a complete provenance chain. No raw PII observable from the analytics role, proven by test.

---

## STAGE 10 — MOD-02 Support Analytics Centre (RTI / MTSS / SIAS)

**Objective.** Screen every learner, test whether core teaching is sufficient before tiering individuals, plan and monitor interventions, and produce SBST, guardian and district reporting — with a human ratifying every consequential decision.

**Agents.**

| ID    | Agent                | Output                                                                    |
| ----- | -------------------- | ------------------------------------------------------------------------- |
| AC-01 | Universal Screener   | Termly screen across literacy, numeracy, attendance, behaviour, wellbeing |
| AC-02 | Core-Health Analyst  | Is Tier 1 sufficient for ≥80%? Blocks mass referral when it is not        |
| AC-03 | Tier Recommender     | Proposed tier with the evidence that justified it                         |
| AC-04 | Early Warning Agent  | Daily risk signals                                                        |
| AC-05 | Intervention Planner | Goal, strategy, dosage, duration, owner                                   |
| AC-06 | Progress Monitor     | Trend line against goal line; continue / intensify / exit                 |
| AC-07 | Fidelity Checker     | Did the intervention run as planned                                       |
| AC-08 | SBST Meeting Scribe  | Agenda, minutes, decisions, next steps                                    |
| AC-09 | SIAS Compiler        | Support-needs documentation pack for referral                             |
| AC-10 | Parent Report Writer | Plain-language progress letters in the family's home language             |

**Pipeline.** `screen → core-health check → tier recommendation → ◆ SBST review → intervention plan → deliver → monitor → decide → ◆ referral sign-off → report`.

**Strict parameters, enforced in code.**

- **AC-02 gates AC-03.** If core health fails for a class, tier recommendations for that class are suppressed and a Tier 1 improvement task is raised instead. Test this.
- No tier change, referral or exit commits without a stored SBST ratification.
- **No diagnostic, clinical or disability language.** Maintain a blocklist plus a semantic classifier; a violating output is refused, not softened. Red-team this with at least 30 attempts.
- Minimum data sufficiency: a stated minimum number of data points and a stated recency window before any recommendation renders. Below that, the UI says "insufficient data", not a guess.
- SIAS process order is enforced by a state machine; steps cannot be skipped to reach a referral faster.
- Safeguarding disclosures detected anywhere in the module escalate immediately to a named human, bypass all queues, and are never summarised into a report.
- Bias monitoring: recommendation rates are monitored across home language, gender and quintile; a divergence beyond a set threshold raises an alert and is reviewed before the term's recommendations publish.

**Steps.**

1. Implement the tier model and the SIAS state machine as data plus code, with every transition audited.
2. Build AC-01 and AC-02. Do not build AC-03 until AC-02's gate is proven.
3. Build AC-03 → AC-07 with evidence linkage on every output.
4. Build AC-08, AC-09, AC-10. AC-10 must produce output in the guardian's home language and at a stated readability level, verified by the readability guardrail.
5. Build the SBST case file surface: one place where everyone who works with a learner sees the same history.
6. Build the reporting pack: learner, class, grade, school and district rollups, each respecting purpose limitation.
7. Tests: golden scenarios for at least 12 learner profiles across the three tiers with known correct tiers; the diagnosis red-team set; the safeguarding escalation drill; the bias monitor on a deliberately skewed fixture.

**Verification.**

```bash
pnpm evals:run --module mod-02
pnpm test:redteam:diagnosis
pnpm test:drill:safeguarding
pnpm test:bias-monitor
pnpm verify:stage 10
```

**Exit gate.** Twelve golden learner scenarios produce the expected tier and the expected evidence. Core-health gate blocks tiering on a failing-core fixture. Diagnosis red-team 100% refused. Safeguarding drill pages a human within the SLO and writes no summary. Bias monitor fires on the skewed fixture.

---

## STAGE 11 — MOD-04 Teaching & Learning Toolbox

**Objective.** Specialist makers that turn a need into a classroom-ready artefact in minutes, always bound to a specific CAPS topic and lesson or a specific missed sub-skill, always teacher-approved.

**Agents.** TB-01 Worksheet Builder · TB-02 Board & Deck Builder · TB-03 Reading Passage Generator (readability-controlled; decodable options for Foundation Phase) · TB-04 Item Writer (cognitive-demand tagged) · TB-05 Memo & Marking Guide Agent · TB-06 Home-Language Adapter (all eleven official languages, LoLT-aware) · TB-07 Accessibility Adapter (large print, dyslexia-friendly, simplified language, braille-ready text) · TB-08 Remediation Pack Builder · TB-09 Extension & Enrichment Agent · TB-10 Resource-Light Activity Agent · TB-11 Visual Brief Writer.

**Pipeline.** `need (teacher ask or system trigger from MOD-01/MOD-02) → brief → retrieve grounding from Brain → draft → fidelity + readability + accessibility check → ◆ teacher approval → deliver → evidence capture → back to the Brain`.

**Strict parameters, enforced in code.**

- Every artefact carries a `caps_topic_id` and either a `lesson_id` or an `intervention_id`. Missing linkage fails validation.
- Reading level is measured, not estimated: run a readability metric appropriate to the language and assert the grade band. Out of band is a hard failure.
- South African contexts, names, currency and measures by default, from tenant settings.
- No fabricated sources, statistics or quotations. Any citation must resolve to a supplied document.
- No learner names in shared materials.
- Answer keys are verified by a separate correctness pass (a second agent solving the items independently and comparing) before the teacher sees them. Disagreement blocks release and flags the item.
- TB-11 writes image briefs only. The system never fabricates imagery presented as real.

**Steps.**

1. Build the artefact model and renderer first: a structured artefact type per output, rendered to the school's templates for print, PDF, DOCX and slides. Structure before prose.
2. Build TB-01, TB-03, TB-04, TB-05 — the core four — with full eval sets. TB-05 requires the independent-verification pass.
3. Build TB-06 with per-language eval sets. Do not ship a language without one. Where the model's quality in a language is below target, mark that language as human-review-required rather than shipping poor output.
4. Build TB-07 with real accessibility validation (contrast, font size, line length, plain-language metrics).
5. Build TB-08 and TB-09 driven by the sub-skill graph in L1, so remediation targets exactly the missed skill.
6. Build TB-02 and TB-10.
7. Build the teacher approval and edit surface, capturing edit diffs as learning signals for Stage 13.
8. Tests: per-agent eval sets; readability band tests per language; answer-key verification catching seeded wrong keys; accessibility validator on known-bad fixtures; a no-fabrication test over a corpus with no supporting source.

**Verification.**

```bash
pnpm evals:run --module mod-04
pnpm test:readability --all-languages
pnpm test:answer-key-verification
pnpm test:accessibility
pnpm verify:stage 11
```

**Exit gate.** For one grade and one subject, a teacher can go from a MOD-02 identified gap to an approved, printable remediation pack in under five minutes with no manual correction. Seeded wrong answer keys are caught 100% of the time. Every shipped language has a passing eval set.

---

## STAGE 12 — MOD-05 Teaching Analytics & PD Studio

**Objective.** Watch the teaching side of the system, infer what would actually help, compose a short course on demand, and hand the conversation to a human coach. Developmental, never punitive.

**Agents.** PD-01 Coverage vs Pacing Analyst · PD-02 Assessment Quality Analyst (item difficulty, discrimination, cognitive spread, marking consistency) · PD-03 Observation Analyst (structured walkthrough notes to themes, not scores) · PD-04 Practice Signal Aggregator · PD-05 PD Gap Detector · PD-06 Micro-Course Composer · PD-07 Coaching Plan Agent · PD-08 CPTD Tracker.

**Pipeline.** `teaching signals → practice analytics → gap detection → PD need profile → ◆ SMT review → micro-course composed → coaching cycle → impact re-measured`.

**Strict parameters, enforced in code.**

- Teacher-level output is developmental. It is technically inaccessible to performance-management surfaces unless a tenant enables an explicitly named setting with a recorded policy reference and staff notification. Default off.
- Minimum cohort size before any comparative reporting renders; below it, the surface shows a suppression notice.
- No rankings, no leaderboards, no individual exposure in shared views. Enforce with a test on every aggregate endpoint.
- Courses are grounded in the school's own evidence plus L3 exemplars, and cite what they are responding to.
- A human coach owns the conversation with the teacher; the system never sends a teacher an unmediated judgement.

**Steps.**

1. Build the teaching-signal model: coverage from MOD-01 and L2, assessment quality from MOD-03, walkthrough notes, artefact edit rates from MOD-04.
2. Build PD-01 and PD-02 as deterministic analytics where possible — psychometrics are computed, not generated.
3. Build PD-03, PD-04, PD-05 with aggregation thresholds enforced in the data layer.
4. Build PD-06 Micro-Course Composer: a 20–40 minute course with input, model, deliberate practice and a check for understanding, rendered as a real learning object, exportable and trackable.
5. Build PD-07 and PD-08. CPTD point values come from supplied policy in L0 — never computed by a model.
6. Build the impact re-measurement loop closing back to step 1.
7. Tests: suppression on small cohorts; a test asserting no endpoint returns a teacher-level ranking; course structure validation; a CPTD calculation test against supplied policy fixtures.

**Verification.**

```bash
pnpm evals:run --module mod-05
pnpm test:aggregation-thresholds
pnpm test:no-ranking-endpoints
pnpm verify:stage 12
```

**Exit gate.** A detected pacing gap produces a grounded micro-course and a coaching plan, reviewed at the SMT gate, with CPTD logged against supplied policy. Small-cohort suppression proven. No ranking surface exists.

---

## STAGE 13 — LE Learning Engine

**Objective.** The Brain becomes more intelligent the more a school uses it — auditably and reversibly. No model weights are trained on learner data.

**Agents.**

| ID    | Agent                      | Output                                                               |
| ----- | -------------------------- | -------------------------------------------------------------------- |
| LE-01 | Signal Collector           | Every approval, edit, rejection and reason code as a labelled event  |
| LE-02 | Correction Differ          | What the human changed, and the correction type                      |
| LE-03 | Outcome Attributor         | Artefact → delivery → learner result                                 |
| LE-04 | Pattern Miner              | What works, for whom, under which conditions, with effect sizes      |
| LE-05 | Exemplar Curator           | Best artefacts promoted into L3 as approved exemplars                |
| LE-06 | Prompt Evolver             | Challenger prompt variants from recurring corrections                |
| LE-07 | Eval Gatekeeper            | Champion vs challenger scoring plus regression                       |
| LE-08 | Commons Publisher          | De-identified, aggregated patterns to the cross-school commons       |
| LE-09 | Decay & Revalidation Agent | Ages out stale patterns; a CAPS or ATP change invalidates dependents |

**Pipeline.** `signal captured → diff and classify → outcome attribution → pattern mining → challenger proposed → offline eval vs champion → ◆ ratify promotion → promote to L3 (versioned) → publish to commons (opt-in) → decay and revalidate`.

**Rules, enforced in code.**

- Learning is tenant-local by default. Cross-tenant publication requires an explicit opt-in, de-identification, aggregation, and a k-anonymity threshold checked at publish time. A pattern below the threshold cannot be published.
- Human corrections outrank model confidence, always — including when the model is statistically right.
- Every promotion is versioned and reversible by one command. Keep a promotion log with the eval delta that justified it.
- Golden sets grow from real corrections (Stage 07 §6), so evaluation tracks the school's actual standard.
- Feedback loops are audited for bias drift: a pattern that improves outcomes for one language group and not others is not promoted as universal.
- Nothing enters L0 or L3 without human ratification.

**Steps.**

1. Build LE-01 and LE-02 against the HITL edit diffs already captured in Stage 06.
2. Build LE-03 Outcome Attributor. Be honest about causality: record the attribution method and its confidence; never present correlation as proof.
3. Build LE-04 with effect sizes and confidence intervals, and a minimum sample threshold.
4. Build LE-05 and LE-06 producing _candidates only_.
5. Build LE-07 on the Stage 07 harness. It must be impossible to promote without passing.
6. Build the ratification surface for HoD, SMT or a curriculum board, showing the candidate, the evidence, the eval delta and the rollback command.
7. Build LE-08 with k-anonymity enforcement and a published-pattern registry.
8. Build LE-09: TTL and revalidation, triggered also by any L0 curriculum version change.
9. Build the **maturity report** a school can see: cold start → locally calibrated → evidence-led → institutional, with the metrics behind each stage (edit rate, first-pass acceptance, time-to-artefact, outcome deltas).
10. Tests: a promotion that fails eval is rejected; a rollback restores the previous champion exactly; a below-threshold pattern cannot be published to the commons; a CAPS version change invalidates dependent exemplars; a bias-divergent pattern is blocked.

**Verification.**

```bash
pnpm --filter @infinite-ai/learning test
pnpm test:promotion-gate
pnpm test:commons-kanonymity
pnpm verify:stage 13
```

**Exit gate.** A real correction captured in Stage 11 flows through to a ratified, versioned exemplar promotion, measurably improving the relevant eval set, and is then rolled back cleanly. Commons publication blocked below threshold. Maturity report renders from real telemetry.

---

## STAGE 14 — Experience surfaces

**Objective.** Role-scoped surfaces that make the system usable by real people in real schools, on the design system, fast on poor connections.

**Surfaces.** Teacher Studio · HoD Console · SMT Dashboard · SBST Casebook · Parent Portal · Learner Space · District Rollup · Prompt Builder (admin) · Run Inspector (platform).

**Steps.**

1. Implement the design system package: tokens as the only source of colour, type, space and shape; the infinity mark; the component layer. No ad-hoc values anywhere in `apps/web`.
2. Build a shared shell: role-aware navigation, tenant switcher for platform roles, the impersonation banner, and a global approval-queue indicator.
3. Build Teacher Studio first — it is the daily surface. Optimise the two flows that matter: "give me tomorrow's lesson" and "this learner is stuck".
4. Build the approval experience once, well, and reuse it for every gate: artefact, diff against previous, evidence used, approve / edit / reject with reason.
5. Build HoD Console (approvals, coverage, quality), SMT Dashboard (system health, tiers, PD), SBST Casebook (case files, meetings, SIAS packs).
6. Build Parent Portal and Learner Space with the strictest data minimisation, home-language support, and low-bandwidth rendering.
7. Build District Rollup on de-identified aggregates only.
8. Build the Prompt Builder for administrators: browse the registry, propose a challenger, see eval results, request ratification. It must be impossible to edit a live champion directly.
9. Accessibility: WCAG 2.2 AA across every surface, verified by automated checks plus a keyboard-only and screen-reader pass on the top ten flows.
10. Performance: server components by default, streaming, budgets — first contentful paint under 1.5 s and interaction-to-next-paint under 200 ms on a mid-range Android on 3G. Enforce with Lighthouse CI budgets.
11. Offline and poor-connection behaviour: optimistic queuing for teacher edits, clear failure states, no silent data loss.
12. Tests: Playwright end-to-end journeys per role; axe accessibility assertions; visual regression on the design system; a permissions test that every surface renders correctly for every role including "no access".

**Verification.**

```bash
pnpm --filter web test
pnpm test:e2e --all-roles
pnpm test:a11y
pnpm test:lighthouse
pnpm verify:stage 14
```

**Exit gate.** Every role can complete its primary journey end to end on seeded data. Zero critical or serious axe violations. Lighthouse budgets met. A teacher journey completes on a throttled 3G profile within the budget.

---

## STAGE 15 — Observability, SLOs, disaster recovery

**Objective.** You can tell what the system is doing, prove it is meeting its promises, and recover it.

**Steps.**

1. Complete OpenTelemetry coverage: one trace ID from user action through agent run, gateway call, Brain retrieval and database write. No orphan spans.
2. Structured logging with tenant, actor, trace and purpose on every line. A log-scrubbing test asserts no PII and no credentials.
3. Metrics and dashboards: request and job latency percentiles, queue depth and age, agent success and refusal rates, guardrail trigger rates, eval scores, token cost per tenant per module, cache hit rate, provider fallback rate, approval queue age, data-quality scores.
4. Define SLOs and error budgets, then alert on burn rate rather than on single failures. At minimum: web availability, agent-run success rate, time-to-artefact, approval-queue age, ingest freshness.
5. Alert routing with runbook links. Every alert must name an owner and a first action.
6. Backups: Postgres point-in-time recovery, object storage versioning, Brain snapshots, and encrypted off-region copies where residency rules allow.
7. Write and then **rehearse** the runbooks in `docs/RUNBOOKS/`: database restore, Brain restore, provider outage, queue backlog, bad prompt promotion rollback, tenant data-erasure request, suspected breach, and a full region-loss drill.
8. Record RTO and RPO per data class and prove them in a drill, not on paper.

**Verification.**

```bash
pnpm test:telemetry-coverage
pnpm test:log-scrubbing
pnpm drill:restore
pnpm verify:stage 15
```

**Exit gate.** A single trace ID traverses a complete user journey. Restore drill meets the stated RTO and RPO with evidence in `docs/STAGE_LOG.md`. Every alert links to a rehearsed runbook.

---

## STAGE 16 — Security hardening and pen-test readiness

**Objective.** Withstand a competent external assessment and a school district's security questionnaire.

**Steps.**

1. Threat model the whole system (STRIDE per trust boundary): browser, web app, worker, gateway, database, object storage, connectors, commons. Record it in `docs/SECURITY.md` with mitigations mapped to tests.
2. Harden inputs: strict Zod validation on every boundary, size limits, content-type enforcement, upload scanning, file-type verification by content not extension, and safe rendering of anything user-supplied.
3. Harden the browser surface: strict Content-Security-Policy with nonces and no `unsafe-inline`, Trusted Types where supported, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, cookie flags `Secure`/`HttpOnly`/`SameSite`, CSRF protection on every state change.
4. Harden identity: MFA enforcement, session fixation and rotation tests, brute-force and credential-stuffing protection, SSO and SCIM for enterprise tenants, and a documented offboarding path.
5. Harden data: verify RLS under every access pattern including background jobs, exports and analytics; verify encryption at rest and in transit; verify key rotation.
6. Harden the agent surface specifically: prompt-injection defence in depth (retrieved content is data, never instruction; tool allow-lists per agent; output validation; no shell, no arbitrary HTTP), plus an insecure-output-handling review of every place an agent's output is rendered or executed.
7. Supply chain: pinned dependencies, lockfile integrity in CI, SBOM generation, vulnerability scanning with a policy on severity and time-to-fix, and provenance attestation on build artefacts.
8. Secrets: rotation procedure, no secret in logs or traces, scanning in CI and in git history.
9. Multi-tenant abuse: per-tenant rate limits, quota enforcement, noisy-neighbour isolation, and a test that one tenant cannot degrade another beyond its SLO.
10. Commission an external penetration test and a POPIA readiness review. Track findings to closure with a test for each.

**Verification.**

```bash
pnpm test:security          # headers, CSRF, CSP, session, upload
pnpm test:rls:exhaustive
pnpm audit:supply-chain
pnpm test:tenant-abuse
pnpm verify:stage 16
```

**Exit gate.** Threat model complete with a test per mitigation. Zero high or critical findings open. Exhaustive RLS suite green. SBOM published. Security questionnaire in `docs/SECURITY.md` answerable without new work.

---

## STAGE 17 — Tenant lifecycle, provisioning, billing

**Objective.** Onboard a school in under a day, run many schools safely, and bill correctly.

**Steps.**

1. Self-serve and assisted provisioning: create tenant, configure school profile (phases, grades, subjects, LoLT and additional languages, term weeks, templates), import staff and learners, connect sources, ratify L0 constitution. Every step resumable and auditable.
2. Build the onboarding wizard with validation at each step and a readiness score before go-live.
3. Tenant configuration as versioned data, not code. A tenant setting change is audited and reversible.
4. Per-tenant model budgets and usage reporting a principal can actually read.
5. Billing: subscription tiers, per-learner or per-educator metering, usage overages, invoicing, dunning, and a reconciliation report between metered usage and gateway telemetry that must agree to the cent.
6. Tenant suspension, export and deletion: a complete, verifiable data export and a deletion that satisfies POPIA while preserving the audit ledger's integrity.
7. Support tooling: read-only tenant inspection, audited impersonation, run inspector access, and a support runbook.
8. Tests: provision a tenant end to end in CI; metering matches telemetry on a synthetic month; deletion leaves no learner data and an intact ledger.

**Verification.**

```bash
pnpm test:provisioning
pnpm test:billing:reconcile
pnpm test:tenant-deletion
pnpm verify:stage 17
```

**Exit gate.** A fresh tenant is provisioned, configured, imported and generating approved artefacts inside one working day, entirely through the product. Billing reconciles exactly. Deletion verified.

---

## STAGE 18 — Launch readiness and handover

**Objective.** Ship with confidence and leave the system maintainable by someone who was not here.

**Steps.**

1. Full regression: every stage's verification command, plus the complete eval suite, plus all safety sets.
2. Load and soak testing with k6 at 3× expected peak, including a term-start ingest spike and a Sunday-evening lesson-planning spike. Fix what breaks; re-run.
3. Cost model validated against real telemetry: cost per school per month, per artefact, per learner, with the gateway's caching and routing in place.
4. Pilot with real schools: a defined pilot protocol, success metrics (first-pass artefact acceptance rate, teacher time saved, tier decision turnaround, data-quality score), and a weekly review that feeds the golden sets.
5. Documentation complete: `ARCHITECTURE.md`, `SECURITY.md`, `POPIA.md`, `AGENTS.md`, `PROMPTS.md`, `DEPENDENCIES.md`, all runbooks, an operator manual and an onboarding guide for schools.
6. Release engineering: trunk-based development, feature flags with an owner and an expiry date, canary deploys, automatic rollback on SLO burn, and a change log.
7. Handover: an architecture walkthrough recording, a "how to add a new agent" tutorial (Part 4), an on-call rotation, and an incident process.

**Exit gate.** Everything green. Pilot metrics met. A new engineer, given only this repository and its docs, adds a working agent end to end in under a day — verify by actually doing it.

---

# PART 3 — AGENT AND PROMPT ENGINEERING STANDARDS

Every agent in this system is built to this standard. No exceptions, no "quick" agents.

## 3.1 Mandatory prompt structure

Each prompt file has these sections in this order. Omitting a section fails registry validation.

```markdown
---
agent: CE-05
version: 3.2.0
model: plan.author
changelog: Tighten template fidelity after HoD corrections in T2
ratified_by: null
---

# ROLE

You are a South African CAPS lesson-planning engine for {{phase}}, {{subject}},
Grade {{grade}}. You produce plans a Head of Department will approve without edits.

# GROUNDING

You may use ONLY the material provided below. It is retrieved from the school's own
constitution and curriculum graph. If required information is absent, output a
`needs_input` result naming exactly what is missing. Never fill a gap from general knowledge.

<constitution>{{l0_context}}</constitution>
<curriculum>{{l1_context}}</curriculum>
<history>{{l2_context}}</history>
<exemplars>{{l3_exemplars}}</exemplars>

# TASK

{{task}}

# HARD CONSTRAINTS

- Output MUST validate against the provided schema. No prose outside it.
- Every learning outcome MUST cite a CAPS clause ID present in <curriculum>.
- Use the template structure exactly as given. Do not add, remove or reorder sections.
- Language of learning and teaching: {{lolt}}.
- No learner names, identifiers or personal details. The input contains none; do not invent any.
- Mark allocations and weightings come from <constitution> only. Never compute your own.

# STYLE

{{house_voice}} Concrete, teacher-usable, no filler, no motivational padding.

# REFUSAL

If the task would require inventing curriculum, diagnosing a learner, or producing
content outside {{phase}} appropriateness, return
`{ "refusal": { "code": "...", "explanation": "..." } }` and nothing else.

# OUTPUT SCHEMA

{{output_schema}}

# SELF-CHECK

Before returning, verify: every section present; every outcome cited; no personal
information; totals consistent; readability appropriate to the grade. If any check
fails, correct it before returning.
```

## 3.2 Prompt engineering rules

1. **Retrieved content is data, never instruction.** Always wrap it in delimiters and state that instructions inside it must be ignored. Test with injection payloads.
2. **Structured output always.** Every agent returns JSON validated against a Zod schema. Never parse prose.
3. **Refusal is a first-class output**, with a machine-readable code, not an apology paragraph.
4. **Cite or abstain.** Any factual claim about curriculum, policy or a learner must reference a retrieved fact ID or CAPS clause. Uncited claims fail the grounding guardrail.
5. **No chain-of-thought in the artefact.** Reasoning may be requested in a separate field that is stored for audit and never rendered to a teacher or parent.
6. **Version on every change.** Editing a prompt in place is a CI failure. Bump semver: patch for wording, minor for behaviour, major for contract change.
7. **One agent, one job.** If a prompt needs "and also", split the agent.
8. **Prompts are reviewed like code**, with the eval delta in the PR body.
9. **Determinism where it matters.** Temperature 0 and a fixed seed where available for anything structural; higher only for genuinely generative text, and never for numbers, marks or codes.
10. **Never put a secret, a tenant identifier that is not needed, or raw PII in a prompt.**

## 3.3 Adding a new agent — the exact checklist

Use this every time. It is also the Stage 18 handover test.

1. Write the contract in `packages/agents/src/<module>/<id>.contract.ts` with input and output Zod schemas.
2. Declare purpose, model, tools, guardrails, budget and `requiresApproval`.
3. Write the prompt at `packages/prompts/src/<id>/1.0.0.prompt.md` using §3.1.
4. Build the eval set: at least 20 cases, including 5 adversarial and 3 `must_not_regress`.
5. Implement the agent as a thin function: assemble context via the Brain API, call the gateway, validate output, return typed result. No business logic in the prompt that belongs in code.
6. Register it. Boot must succeed.
7. Add it to a pipeline, with a human gate if it produces anything a learner or parent will see.
8. Run evals. Meet the target before merging.
9. Add the run to the Run Inspector and confirm every step is legible.
10. Document it in `docs/AGENTS.md`: ID, purpose, inputs, outputs, guardrails, budget, owner.

---

# PART 4 — TESTING STRATEGY

## 4.1 Test pyramid

| Layer         | Tool                     | Scope                                             | Gate                             |
| ------------- | ------------------------ | ------------------------------------------------- | -------------------------------- |
| Unit          | Vitest                   | Pure logic, schemas, scorers                      | Every PR                         |
| Property      | fast-check               | De-identification, packers, date and term maths   | Every PR                         |
| Integration   | Vitest + Testcontainers  | Database, RLS, queues, Brain paths                | Every PR                         |
| Contract      | Zod + generated fixtures | API and agent boundaries                          | Every PR                         |
| Security      | Custom suites            | RLS, PII egress, injection, headers, authz matrix | Every PR                         |
| Eval          | Promptfoo + Langfuse     | Agent quality                                     | On agent/prompt/retrieval change |
| End-to-end    | Playwright               | Role journeys                                     | Every PR (smoke), nightly (full) |
| Load          | k6                       | Peak and spike profiles                           | Stage 18, then monthly           |
| Chaos / drill | Custom                   | Provider outage, worker kill, restore             | Stage gates, then quarterly      |

## 4.2 Coverage and quality thresholds

- Overall line coverage ≥ 80%, branch ≥ 75%.
- `packages/policy`, `packages/deident`, `packages/guardrails`, `packages/db` (tenant client and RLS): line coverage ≥ 95%. These are the safety-critical packages.
- Zero skipped tests in committed code. CI fails on any `.skip`, `.only` or `todo` in a test file.
- Mutation testing on the safety-critical packages before Stage 16; surviving mutants must be justified in writing.

## 4.3 The permanent safety suite

Runs on **every** change regardless of what changed:

1. Cross-tenant leakage (exhaustive, table-driven).
2. PII egress attempts through every agent.
3. Prompt injection through retrieved documents, user input and uploaded files.
4. Diagnosis and clinical-language refusal.
5. Safeguarding escalation drill.
6. HITL bypass attempts.
7. Authorisation matrix.
8. Log and trace scrubbing.

If any of these fails, nothing merges. There is no override.

## 4.4 Bug protocol

1. Reproduce with a failing test **first**. No fix without a test that fails before it.
2. Fix the root cause, not the symptom. If you find yourself adding a special case, stop and re-read the design.
3. Classify: was this a missing test, a missing guardrail, or a design flaw? Record it in `docs/STAGE_LOG.md`.
4. If the bug involved tenancy, PII, authorisation or a gate: add a case to the permanent safety suite and write a short post-mortem.

---

# PART 5 — EXTENSIBILITY

The system must absorb new features without loosening any rule.

## 5.1 Adding a feature

1. Write a one-page brief in `docs/features/<slug>.md`: problem, user, purpose (from the taxonomy), data touched, agents involved, guardrails required, tests required, rollback plan.
2. Classify it: new agent (§3.3), new pipeline, new surface, new connector, or new module.
3. If it needs a new data category or purpose, update the POPIA documentation and the consent model **first**, and get that ratified before writing code.
4. Feature-flag it with an owner and an expiry date. Flags without expiry dates fail CI.
5. Ship behind the flag, evaluate, then remove the flag. A flag older than 90 days is a bug.

## 5.2 Adding a module

A new module (MOD-06 and beyond) must supply: its own agent set built to §3.3, its purpose declarations, its Brain read and write contracts, its guardrails, its eval sets, its surfaces, and its own stage in `docs/STAGE_LOG.md`. It may not introduce a new datastore, a new auth path, or a direct provider call.

## 5.3 What may never be added

- A second path to a model provider.
- A way to read learner data without a purpose.
- A way to approve an artefact without a human.
- A destructive write to the Brain.
- A cross-tenant query on identifiable data.

If a feature request requires one of these, refuse it and escalate to the human. Record the refusal in `docs/OPEN_QUESTIONS.md`.

---

# PART 6 — QUICK REFERENCE

## 6.1 Forbidden patterns

```
any                       @ts-ignore                 @ts-expect-error (unlinked)
.only  .skip  xit  xdescribe                         process.env outside packages/config
new PrismaClient() outside packages/db               raw provider SDK outside apps/gateway
SKIP_APPROVAL / BYPASS_* flags                       UPDATE on a superseded Brain row
string concatenation into SQL                        secrets in fixtures or seeds
console.log in committed code (use the logger)       catch {} with an empty body
```

## 6.2 Stage gate command

```bash
pnpm verify:stage <NN>     # must exit 0 before the next stage begins
```

## 6.3 Escalation triggers — stop and ask

Conflicting requirements · missing credential or source document · irreversible data operation · a control you would need to weaken · ambiguous CAPS / ATP / SIAS / CPTD rule · PII needed in a prompt · unmeetable exit gate · budget overrun above 30%.

## 6.4 Glossary

**ATP** Annual Teaching Plan (DBE). **CAPS** Curriculum and Assessment Policy Statement. **CPTD** Continuing Professional Teacher Development (SACE). **HoD** Head of Department. **LoLT** Language of Learning and Teaching. **MTSS** Multi-Tiered System of Support. **POPIA** Protection of Personal Information Act. **RLS** Row-Level Security. **RTI** Response to Intervention. **SACE** South African Council for Educators. **SBST** School-Based Support Team. **SIAS** Screening, Identification, Assessment and Support. **SMT** School Management Team.

---

_End of manual. Work the stages in order. When in doubt, stop and ask._
