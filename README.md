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

Node 22+ and pnpm 10+ are required. The commands above are everything the automated test
suites need — the integration tier (real Postgres, via Testcontainers) is self-contained
and needs nothing beyond a running Docker daemon. For the full local stack (Postgres,
Redis, Keycloak, the gateway, the worker, the web app), see `docs/DEV_SETUP.md`.

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

All 19 stages of the original build manual (00–18) are complete, plus a further
extension phase (Stages 19–52) covering the Visual Agent Builder, Prompt/System Prompt
Builders, game-based learning, low-tech assessment, document annotation, the learner
client, PD journal, and the Learning Engine's own orchestrator pipelines. Full detail,
stage by stage, is in `docs/STAGE_LOG.md`.

This is not yet pilot-ready. A number of items are blocked on a human decision or a
credential this build cannot supply itself — a paging integration for safeguarding
escalation, LLM-judge calibration data, load-test results from a live environment, and
identifying actual pilot schools among them — tracked in `docs/OPEN_QUESTIONS.md`.
