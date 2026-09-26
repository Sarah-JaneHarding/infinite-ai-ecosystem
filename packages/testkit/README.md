# @infinite-ai/testkit

Test factories, tenant fixtures and seeded scenarios shared across the monorepo's test
suites — every fixture requires a tenant scope, on purpose.

## What's here

- `tenantScope()` — a fresh `{ tenantId, actorId }` pair per call, so tests cannot
  collide on shared identifiers.
- `defineFactory()` — builds a `Factory<T>` whose first parameter is always a
  `TenantScope`; there is no overload that omits it, so a factory call that forgets a
  tenant is a compile error rather than a silently-tenantless fixture.
- `aTenant`, `aSchool`, `aLearner`, `aStaffMember` — the core fixtures. `aLearner`
  deliberately carries no name, ID number, or date of birth — only a tenant-salted
  token — mirroring rule 4 (no learner PII) in the shape of the fixture itself, so a test
  written against this factory cannot accidentally start asserting against a fabricated
  identity.
- `withTenant()` — the test-side counterpart to `packages/db`'s `withTenant()`; running a
  test body through it means a test cannot forget to establish a scope, the same
  guarantee the production tenant-scoped client gives production code.

## Where it fits

Stage 01's data-foundation work. Any package's test suite that needs a plausible tenant,
school, learner, or staff fixture — most of `packages/db`, `packages/policy`, and several
module packages — depends on this one rather than hand-rolling its own fixture shapes.

## Running its tests

```bash
pnpm --filter @infinite-ai/testkit test
```

Unit tier only, no external services required.
