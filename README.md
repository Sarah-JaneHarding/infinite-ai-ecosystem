# INFINITE-AI Education Ecosystem

Multi-tenant SaaS for South African schools. One Brain, five modules, a pipeline that
never forgets — CAPS-aligned, DBE-current agents working inside strict parameters, under a
POPIA-safe governance plane, getting more intelligent with every school that uses it.

> **Read `CLAUDE.md` before you touch anything.** It carries the eleven rules that are
> binding for the whole build, and most of them are enforced by tooling rather than trust.

## The system

| ID     | Subsystem                      | Purpose                                                                      |
| ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| BRAIN  | Infinite Brain                 | Durable institutional memory (L0–L4) that never loses a policy or a decision |
| LE     | Learning Engine                | Makes the Brain more intelligent with use — auditably and reversibly         |
| MOD-01 | Curriculum Engine              | CAPS → ATP → term → unit → lesson → assessment                               |
| MOD-02 | Support Analytics Centre       | RTI / MTSS on DBE SIAS: screen, tier, intervene, monitor, report             |
| MOD-03 | Data Collection & Warehouse    | Ingest, conform, de-identify, Learner-360, insight, next step                |
| MOD-04 | Teaching & Learning Toolbox    | Specialist agents that make classroom materials                              |
| MOD-05 | Teaching Analytics & PD Studio | Practice analytics, PD gap detection, courses on demand                      |

See `docs/ARCHITECTURE.md` for the layer stack and the six flows.

## Getting started

```bash
pnpm install --frozen-lockfile
cp .env.example .env          # then fill it in locally; never commit it
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm verify:stage 00
```

Node 22+ and pnpm 10+ are required. The dev data plane (Postgres 16 with pgvector, Redis 7) comes up with `docker compose -f infra/docker/compose.dev.yml up -d` from Stage 01.

## Build pipeline

Nineteen stages, worked strictly in order. A stage does not begin until the previous
stage's exit gate has passed and been recorded in `docs/STAGE_LOG.md`.

| Stage | Name                                          | Depends on |
| ----- | --------------------------------------------- | ---------- |
| 00    | Ground rules, repo, toolchain                 | —          |
| 01    | Data foundation, tenancy, RLS                 | 00         |
| 02    | Identity, RBAC, audit ledger                  | 01         |
| 03    | POPIA layer                                   | 01, 02     |
| 04    | Model Gateway                                 | 00         |
| 05    | Infinite Brain (L0–L4)                        | 01, 03, 04 |
| 06    | Agent runtime, orchestrator, guardrails, HITL | 04, 05     |
| 07    | Eval harness and golden sets                  | 06         |
| 08    | MOD-01 Curriculum Engine                      | 06, 07     |
| 09    | MOD-03 Data Warehouse                         | 03, 06     |
| 10    | MOD-02 Support Analytics                      | 09         |
| 11    | MOD-04 Teaching & Learning Toolbox            | 08, 10     |
| 12    | MOD-05 Teaching Analytics & PD                | 08, 09, 11 |
| 13    | LE Learning Engine                            | 07, 12     |
| 14    | Experience surfaces                           | 08–13      |
| 15    | Observability, SLOs, DR                       | 14         |
| 16    | Security hardening                            | 15         |
| 17    | Tenant lifecycle, provisioning, billing       | 16         |
| 18    | Launch readiness and handover                 | 17         |

```bash
pnpm verify:stage <NN>    # cumulative — runs this stage's gate and every earlier one
```

## Layout

```
apps/       web · worker · gateway
packages/   db · brain · agents · prompts · guardrails · orchestrator · deident
            policy · contracts · evals · design-system · telemetry · testkit · config
infra/      docker · terraform
docs/       ARCHITECTURE · SECURITY · POPIA · AGENTS · PROMPTS · DEPENDENCIES
            STAGE_LOG · OPEN_QUESTIONS · RUNBOOKS/
scripts/    verify-stage.ts · spin-out-repo.sh
```

## The rules, in brief

No model call bypasses the gateway. No learner PII enters a prompt. Every query goes
through the tenant-scoped client. Human approval gates have no bypass. Nothing in the
Brain is destructively updated. No secret in the repository. Tests are never skipped to
go green.

The long form is `CLAUDE.md`; the enforcement is `eslint.config.mjs` and CI.

## Status

Stage 00, in progress. Open questions that block later stages — the CAPS and ATP source
documents, the school's artefact templates — are logged in `docs/OPEN_QUESTIONS.md`.
