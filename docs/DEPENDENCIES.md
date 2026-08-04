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

## Adding a dependency

1. Check whether something already in the tree does the job.
2. Check the licence. If it is not MIT / Apache-2.0 / BSD / ISC, stop and ask.
3. Pin the exact version. No ranges — Stage 16 requires reproducible builds and lockfile
   integrity.
4. Add a row above, in the stage's section, in the same commit that adds the dependency.
