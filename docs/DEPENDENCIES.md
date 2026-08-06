# Dependencies

Rule 9: no new dependency without recording its name, version, licence, why it is needed
and what it replaces. Anything outside MIT / Apache-2.0 / BSD / ISC needs explicit
approval before it is added.

## Stage 00 — toolchain

| Package                  | Version | Licence    | Why                                                                                                                         | Replaces |
| ------------------------ | ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| `typescript`             | 5.9.3   | Apache-2.0 | The language. Strict mode is rule 8.                                                                                        | —        |
| `turbo`                  | 2.10.7  | MIT        | Task graph and caching across the workspace. Remote cache stays off until Stage 15.                                         | —        |
| `eslint`                 | 9.39.5  | MIT        | Mechanically enforces Part 0 rather than relying on memory.                                                                 | —        |
| `@eslint/js`             | 9.39.5  | MIT        | ESLint's own recommended rule set.                                                                                          | —        |
| `typescript-eslint`      | 8.65.0  | MIT        | TypeScript rules: no-explicit-any, ban-ts-comment (rule 8).                                                                 | —        |
| `eslint-config-prettier` | 10.1.8  | MIT        | Turns off stylistic rules that fight the formatter.                                                                         | —        |
| `prettier`               | 3.9.6   | MIT        | One formatter, no formatting debates in review.                                                                             | —        |
| `lint-staged`            | 16.4.0  | MIT        | Runs lint and format on staged files only, so the hook stays fast.                                                          | —        |
| `husky`                  | 9.1.7   | MIT        | Git hooks: pre-commit lint, pre-push unit suite (Stage 00 step 5).                                                          | —        |
| `vitest`                 | 3.2.7   | MIT        | Unit and integration test runner (Part 4 §4.1).                                                                             | —        |
| `tsx`                    | 4.23.1  | MIT        | Runs `scripts/verify-stage.ts` without a build step.                                                                        | —        |
| `@types/node`            | 22.20.1 | MIT        | Node type definitions.                                                                                                      | —        |
| `zod`                    | 3.25.76 | MIT        | Runtime validation. `unknown` + a Zod parse is the sanctioned pattern under rule 8, and every API contract is a Zod schema. | —        |

All licences above are MIT or Apache-2.0. Nothing on this list needs an approval
exception.

## Stage 01 — data foundation

| Package                      | Version | Licence    | Why                                                                                              | Replaces |
| ---------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------ | -------- |
| `prisma`                     | 6.19.3  | Apache-2.0 | ORM and migration engine, locked by §1.1.                                                        | —        |
| `@prisma/client`             | 6.19.3  | Apache-2.0 | The generated client the tenant-scoped wrapper wraps.                                            | —        |
| `testcontainers`             | 12.0.4  | MIT        | Real Postgres per test run, locked by §1.1 and Part 4 §4.1.                                      | —        |
| `@testcontainers/postgresql` | 12.0.4  | MIT        | The Postgres module for the above.                                                               | —        |
| `@vitest/coverage-v8`        | 3.2.7   | MIT        | Coverage, to hold `packages/db` to the ≥ 95% line threshold in §4.2. Pinned to the Vitest minor. | —        |

### Why Prisma 6 rather than 7

Prisma 7 is current, and choosing a version behind it needs a reason on the record.

Prisma 7 removes the Rust query engine and requires a driver adapter for Postgres. That
is a materially different connection path, and the connection path is precisely what
carries the transaction-local `app.tenant_id` setting that every RLS policy depends on.
This environment has no Docker and no Postgres server, so nothing here can be exercised
against a real database before it reaches CI — and a new connection architecture is the
wrong thing to adopt blind, on the one layer where a subtle bug is a cross-tenant leak.

Prisma 6 is supported and behaves the way the tenant client assumes. The upgrade to 7
should be its own change, made when there is a working RLS suite to prove it did not
break isolation. Revisit at Stage 16, where the supply-chain review runs.

## Stage 04 — Model Gateway

Steps 1–7, 9 and 10 needed no new dependency: `apps/gateway` uses `zod` (schemas for the
OpenAI-compatible wire contract), `tsx` (the `start` script) and `@vitest/coverage-v8`
(coverage), all already recorded above at the versions pinned there. Provider calls go
over the platform `fetch`, not a provider SDK — rule 3 confines the one exception
(`apps/gateway/src/adapters/`) to adapter code, and there is nothing in it to add here,
since no SDK was pulled in at all.

Step 8 (OTel spans, Langfuse traces) added the official OpenTelemetry JS SDK to
`packages/telemetry`:

| Package                                   | Version | Licence    | Why                                                                                                                                                                                                                                                                                                     | Replaces |
| ----------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `@opentelemetry/api`                      | 1.9.1   | Apache-2.0 | The stable OTel API surface (`Span`, `SpanStatusCode`) that `packages/telemetry/src/tracing.ts` wraps.                                                                                                                                                                                                  | —        |
| `@opentelemetry/sdk-trace-base`           | 2.10.0  | Apache-2.0 | `BasicTracerProvider`, `BatchSpanProcessor` and the in-memory exporter used by tests. The base (non-Node) SDK is enough — this module passes an explicit `Span` through call sites rather than relying on `AsyncLocalStorage` context propagation, so `sdk-trace-node`'s context manager is not needed. | —        |
| `@opentelemetry/exporter-trace-otlp-http` | 0.221.0 | Apache-2.0 | Ships spans over OTLP/HTTP. Langfuse ingests OTLP directly at its own endpoint, so no Langfuse-specific SDK is needed — see `tracing.ts`'s file header.                                                                                                                                                 | —        |
| `@opentelemetry/resources`                | 2.10.0  | Apache-2.0 | `resourceFromAttributes()`, to tag every span with `service.name`.                                                                                                                                                                                                                                      | —        |
| `@opentelemetry/semantic-conventions`     | 1.43.0  | Apache-2.0 | The standard `service.name` attribute key, rather than a hand-typed string.                                                                                                                                                                                                                             | —        |

All five are the official CNCF OpenTelemetry JS packages, Apache-2.0, and none needs an
approval exception. `apps/gateway` takes `@opentelemetry/sdk-trace-base` as a devDependency
only, to build an in-memory span exporter in its own tests — the real exporter is built
once in `packages/telemetry` and consumed through its `Tracer`/`Span` interface, never
imported directly by application code.

## Stage 05 step 1 — Infinite Brain, L0-L4 tables

No new dependency. L0-L3 are Prisma models in `packages/db`, on the same `zod`/`prisma`
already recorded above. `pgvector` (the `vector` extension `brain_embedding` uses) was
already installed by `infra/docker/initdb/01-extensions.sql` in Stage 00, reserved for
this stage.

L4 Working memory (`packages/brain/src/working-memory.ts`) is a `WorkingMemoryStore`
interface plus an in-memory implementation, deliberately not a Redis client. The manual
does name Redis for this tier, but there is no concrete per-run scratchpad to wire one to
until Stage 06's orchestrator produces an actual run — adding `ioredis` (or `redis`) now,
before anything calls it, is exactly what rule 9 exists to stop. The choice between them
is Stage 06's to make, when there is a real caller to make it against.

## Stage 05 step 2 — the write path

No new dependency, only reuse at pinned versions already recorded above. `packages/brain`
took `@infinite-ai/db` (workspace) as a runtime dependency for the first time — it now
calls `withTenant()` itself rather than only being called through it — and `zod` for the
"extracted+typed" transition's per-tier schemas, the same `zod` recorded in Stage 00.

Its integration suite needed a real Postgres the same way `packages/db`'s own suite does,
so `packages/brain` took `@testcontainers/postgresql` and `testcontainers` as
devDependencies, both already recorded in Stage 01 at the same versions. It does not take
`@prisma/client`: its harness (`test/support/database.ts`) shells out to the Prisma CLI
already installed in `packages/db` to run migrations, and every actual query in the suite
goes through `@infinite-ai/db`'s own `withTenant()` — there was never a reason to construct
a second Prisma client.

## Stage 05 step 3 — contradiction resolution

No new dependency. `brain_conflict_queue` is another Prisma model in `packages/db`, on the
same `prisma`/`zod` already recorded; the provenance comparison it depends on
(`resolveContradiction`) is pure TypeScript in `packages/brain`, with nothing to add.

## Stage 05 step 4 — the retrieval path

No new dependency — every addition is a workspace package already built, taken as a real
runtime dependency for the first time. `packages/brain` took `@infinite-ai/policy`
(`authorize()`/`resolveAccess()`, composed for the first time anywhere in the repo — see
`retrieval-policy-gate.ts`'s own header for why no composed gate existed before this),
`@infinite-ai/contracts` (`Purpose`/`DataCategory`/`ConsentEntry` types the policy gate
needs), and `@infinite-ai/telemetry` (`Tracer`/`Span`, the same interface `apps/gateway`
already threads through its own request handling — "every stage individually testable and
traced" is this stage's own exit-gate text).

Its integration suite proves tracing against a real span, the same way `apps/gateway`'s
own tests do: `@opentelemetry/sdk-trace-base`'s `InMemorySpanExporter` as a devDependency,
already recorded in Stage 04 at 2.10.0 and taken there the same way (devDependency only,
for an in-memory exporter in tests — never the real OTLP path).

## Stage 05 step 5 — token-budgeted assembly's real packer

No new dependency. `packages/db/src/brain-retrieval.ts` gained two read functions
(`listEffectiveConstitution`, `listEffectiveExemplars`) on the same Prisma client already
recorded in Stage 01; `packages/brain`'s `assembleContext` rewrite and the two new
retrieval-path stages that feed it (`constitution_fetched`, `exemplars_fetched`) are pure
additions to code already built in step 4, on packages already taken as dependencies
there. The one internal change worth recording: `write-path-schemas.ts`'s
`BrainConstitutionKind` Zod enum, previously module-private, is now exported and imported
by `retrieval-types.ts` — the same reasoning `BrainEntityType` was already exported for in
step 4, so `packages/brain` keeps not taking `@prisma/client` as a dependency of its own.

## Stage 05 step 6 — provenance

No new dependency. `packages/db/src/brain-provenance.ts` is a new file, but its one export
(`getFactProvenance`) is a read against the same five Prisma models every other Brain
module in this package already queries, on the same client recorded in Stage 01. No
package outside `packages/db` takes a new dependency for this step: nothing in
`packages/brain` calls it yet — that caller is step 9's `explain()`.

## Stage 05 step 7 — never-forget guarantees

`packages/db` takes `@infinite-ai/telemetry` (Stage 04, already pinned there) as a real
runtime dependency for the first time — a workspace package already built, not a new
external one. `packages/db/src/audit.ts`'s `appendAuditEvent` calls
`@infinite-ai/telemetry`'s `chainEvent` (the pure hash-chain logic Stage 02 built but that
nothing in `packages/db` had called until now) to actually chain and persist an
`audit_event` row, closing the gap `erasure.ts`'s own `writeErasureEvent` comment
(Stage 03) already flagged: "the tamper-evident chain... is Stage 02's, and this call site
links into it when that lands." No dependency cycle: `@infinite-ai/telemetry` takes no
workspace dependencies of its own.

## Stage 05 step 8 — forgetting by design

No new dependency. `packages/db` gained two files (`retention.ts`'s `getRetentionRule`,
`brain-forgetting.ts`'s `tombstoneBrainFact`), both reads/writes against Prisma models
already recorded (`RetentionRule` from Stage 03, `BrainNode`/`BrainEdge` from Stage 05
step 1) plus the `appendAuditEvent` this package already took a dependency on for step 7.
`packages/brain`'s `forgetting.ts` reuses `@infinite-ai/contracts`'s `evaluateRetention`
(Stage 03) — the first real caller anywhere in the repo, closing that stage's own OQ-007
gap for the Brain's own tables, though not for Stage 03's own, which remains its own
follow-up.

## Stage 05 step 9 — the Brain API

No new dependency. `packages/brain/src/api.ts` is a new file, but it introduces no import
that was not already reachable from this package: `remember`/`supersede` compose
`openWrite`/`run` (step 2), `recall` is `retrieve` (steps 4-5), `ratify` composes
`write-path.ts`'s own `ratify` with `run`, `forget` wraps `@infinite-ai/db`'s
`tombstoneBrainFact` (step 8), and `explain` is the first real caller of
`@infinite-ai/db`'s `getFactProvenance` (step 6) that module's own header already named
this step as owning.

## Stage 05 step 10 — the stage's own test suite

No new dependency. The restore drill (`packages/brain/test/restore.integration.spec.ts`)
calls `snapshot()`/`restoreSnapshot()` on the `StartedPostgreSqlContainer`
`@testcontainers/postgresql` (pinned since step 2) already returns from `.start()` —
methods that library ships, not new surface added here. Everything else this step adds
(the temporal test, the episodes-specific policy-gate test, three more `explain()` chain
tests) composes functions steps 2, 4, 6, 8 and 9 already built.

## Stage 06 step 1 — the Agent contract

No new dependency. `packages/agents` takes `@infinite-ai/contracts` (already pinned
throughout the tree) as a real runtime dependency for the first time — for `Purpose` (the
manual's own "purpose, from the taxonomy") and `LogicalModel` (Stage 04's own logical-model
naming, reused rather than re-invented so an agent's `model` field can never name a
concrete provider model). `zod` is pinned at the same version (`3.25.76`) every other
package in the tree already uses.

## Stage 06 step 2 — the Agent Registry

No new dependency. `packages/agents/src/registry.ts` is a new file, but it only calls
`validateAgentContract` (step 1, same package) and holds a plain in-memory `Map` — no
new package needed for either.

## Stage 06 step 3 — the Prompt Registry

`packages/prompts` takes `@infinite-ai/contracts` (`LogicalModel`) and `zod`, both already
pinned throughout the tree — no new package for either. Deliberately **not** added: a YAML
parsing library (`js-yaml`, `gray-matter`, etc.). Every prompt file's front matter is
hand-authored to Part 3.1's own flat `key: value` shape (the one exception, `ratified_by:
null`, is a bare literal, not a YAML feature this format actually needs) — never arbitrary
external YAML — so `loader.ts` parses it with a two-line splitter instead. Rule 9's first
question ("check whether something already in the tree does the job") has no candidate in
the tree either way; the second question is whether the job needs one at all, and this one
does not.

## Stage 06 step 4 — the DAG orchestrator

No new dependency. `packages/orchestrator` takes `@infinite-ai/db` (the tenant-scoped
client and the new `orchestrator.ts` persistence primitives) and `@infinite-ai/telemetry`
(`Tracer`/`Span`, the same interface Stage 05's retrieval path and `apps/gateway` already
thread through) as real runtime dependencies for the first time, plus `zod` — all three
already pinned throughout the tree. Its devDependencies are the same pair every other
Testcontainers-backed package in this repo already carries at the same pinned versions:
`testcontainers`/`@testcontainers/postgresql` (12.0.4, first recorded Stage 01) for its own
integration suite's Postgres, and `@opentelemetry/sdk-trace-base` (2.10.0, first recorded
Stage 04) for `InMemorySpanExporter`, proving the run's one `trace_id` lands on every step
span the same way Stage 05 step 4's own integration suite already proves tracing.

## Stage 06 step 5 — Human-in-the-loop gates

No new dependency. `packages/db/src/approval.ts` and `packages/db/src/roles.ts` are new
files, but both are built entirely on `@prisma/client` (already pinned) and this package's
own `TenantClient`; `packages/orchestrator/src/runner.ts`'s `decideHumanGate` composes
`zod` (already a runtime dependency of this package since step 4) for input validation and
`@infinite-ai/db`'s own `appendAuditEvent` (Stage 05 step 7) for the decision's audit-event
record — no package gained a dependency it did not already have.

## Stage 06 step 6 — the Guardrail engine

No new dependency. `packages/guardrails` takes `@infinite-ai/contracts` (`DataCategory`),
`@infinite-ai/policy` (`resolveAccess`, `AccessRequest` — Stage 03 step 3) and
`@infinite-ai/telemetry` (`Tracer`, the same interface every other traced call site in this
repo already threads through) as real runtime dependencies for the first time, plus `zod`
— all four already pinned throughout the tree. Its devDependency is the same
`@opentelemetry/sdk-trace-base` (2.10.0, first recorded Stage 04) every other traced
package already carries, for `InMemorySpanExporter` in `test/engine.spec.ts`. Deliberately
**not** added: a tokenizer library, for the same reason `packages/brain/src/retrieval-
assembly.ts`'s own `estimateTokens` gave in Stage 05 step 5 — a `Math.ceil(length / 4)`
estimate is honest about being approximate and a conservative overestimate never silently
lets a budget be exceeded, so a real tokenizer is a dependency this stage still does not
justify. This package deliberately takes no dependency on `@infinite-ai/agents` or
`@infinite-ai/db` — see `docs/STAGE_LOG.md`'s step 6 entry for why (the layer diagram has
the agent runtime sit above this package, and nothing yet calls this engine at a point
where a tenant transaction is open).

## Stage 06 step 7 — the Tool registry

No new dependency. `packages/agents/src/tool-registry.ts` only calls `ToolDeclaration`
(step 1, same package) and holds a plain in-memory `Map`, the same shape
`AgentRegistry` (step 2) already uses. `packages/orchestrator/src/dag.ts`'s
`validatePipelineGating` takes its irreversible-tool check as a plain injected callback
rather than a dependency on `@infinite-ai/agents` — see `docs/STAGE_LOG.md`'s step 7 entry
for why a cross-package dependency between two peer packages in the same architectural
layer was the wrong shape here.

## Stage 06 step 8 — Cost and rate control

No new dependency. `packages/orchestrator/src/concurrency.ts` and `fairness.ts` are new
files holding only plain in-memory data structures (`Map`, arrays) — no package needed for
either. `apps/gateway/src/circuit-breaker.ts` is the same: a hand-written state machine,
no dependency added. A production-grade circuit-breaker or rate-limiting library (e.g.
`opossum`, `cockatiel`, `bottleneck`) was considered and rejected for the same reason
`packages/brain`'s own token estimate stayed a one-line heuristic rather than pulling in a
tokenizer: the state machine step 8 actually needs (three states, one threshold, one
cooldown) is small enough that a library would trade a real dependency (a licence to
track, a supply-chain surface, an API to learn) for less clarity than fifty lines of plain
TypeScript this team already owns end to end.

## Stage 06 step 9 — the Run Inspector

No new dependency. `packages/orchestrator/src/inspector.ts` only calls `getRun`/
`listStepRuns` (`@infinite-ai/db`, already a dependency) and reshapes their result with
plain object/array operations. The four new `OrchestratorStepRun` columns are a plain
Prisma migration, no new package.

## Stage 07 step 1 — the eval case format

No new dependency. `packages/evals/src/case.ts` only calls `zod`, already declared
repo-wide in Stage 00 ("every API contract is a Zod schema") — this is simply that
package's first real use of it.

## Stage 07 step 2 — the scorers

No new external dependency. `packages/evals` now depends on `@infinite-ai/guardrails`
(workspace package, already in the tree since Stage 06 step 6) — `scorers.ts` reuses its
`scoreReadability`, `checkGrounding` and `checkRefusalPolicy` directly for the readability,
citation-validity and refusal-correctness scorers, rather than reimplementing any of the
three and risking this package's notion of "correct" drifting from what the guardrail
engine enforces at runtime.

## Stage 07 step 3 — the runner

No new dependency. `packages/evals/src/runner.ts` only calls `scoreExpectation` (step 2,
same package) and holds plain in-memory data structures — no package needed for either
`runEvalSet` or `diffAgainstChampion`.

## Stage 07 step 4 — champion / challenger

No new external dependency. `packages/evals` now also depends on `@infinite-ai/agents`
(workspace package, already in the tree since Stage 06 step 1) — `promotion.ts` reuses its
`AgentBudget` type directly for the budget gate, rather than declaring a second, possibly
divergent budget shape.

## Stage 07 steps 5-8 — CI wiring, growth loop, safety set, dashboard

No new dependency. `discovery.ts` and `champion-store.ts` use only `node:fs`/`node:path`;
`affected.ts`, `gate.ts`, `agent-executors.ts`, `safety-set.ts`, `growth-loop.ts` and
`dashboard.ts` are all plain functions over this package's own existing types. The two new
root-level CLI scripts (`scripts/evals-run.ts`, `scripts/evals-gate.ts`) reuse `tsx`
(already a root dependency since Stage 00, the same runner `scripts/verify-stage.ts` and
`scripts/check-retention-schedule.ts` already use) and add `@infinite-ai/evals` itself as a
new root `devDependency` — a workspace package, not an external one.

## Stage 08 step 1 — machine-readable template definitions, versioned in L0

No new dependency, external or workspace. `packages/contracts/src/curriculum/template.ts`
only calls `zod`, already declared. `packages/guardrails/src/template-fidelity.ts` adds no
new package.json entry either — `@infinite-ai/contracts` was already a `guardrails`
dependency (Stage 03). `packages/brain/src/curriculum-templates.ts` calls only `remember()`
(this package's own `api.ts`, Stage 05) and `@infinite-ai/contracts`, already a `brain`
dependency. No real template instance was added: `docs/SOURCE_DOCUMENTS.md` OQ-003 records
that no school has supplied one yet, so this step ships only the schema and the mechanism
that will version a real definition into L0 once one exists — the same "empty vessel"
shape `curriculum/framework.ts` already established for CAPS content itself.

## Adding a dependency

1. Check whether something already in the tree does the job.
2. Check the licence. If it is not MIT / Apache-2.0 / BSD / ISC, stop and ask.
3. Pin the exact version. No ranges — Stage 16 requires reproducible builds and lockfile
   integrity.
4. Add a row above, in the stage's section, in the same commit that adds the dependency.
