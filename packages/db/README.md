# @infinite-ai/db

Prisma schema, migrations, the tenant-scoped client, and the RLS isolation suite. Rule 5
("every database read and write goes through the tenant-scoped client") is enforced here:
this package exports `withTenant()` and types — never the raw Prisma client — and a test
asserts that export surface directly, because the guarantee is only worth what it's
checked by.

## What's here

- `client.ts` — `withTenant()`, the one way to get a database connection. It opens a
  transaction and sets `app.tenant_id` transaction-locally; every RLS policy reads it via
  the _raising_ form of `current_setting`, so a context-less query errors instead of
  quietly matching nothing.
- `tables.ts` — `TENANT_OWNED_TABLES`, `APPEND_ONLY_TABLES`, `NON_TENANT_TABLES`: the
  classification the RLS isolation suite is driven off of. A new tenant-owned table
  cannot escape the isolation proof without failing a test.
- `audit.ts` / `consent.ts` / `erasure.ts` / `retention.ts` — the append-only audit
  ledger, the consent ledger, POPIA erasure, and retention-rule storage.
- `encryption.ts` — field-level encryption for the columns that need it at rest.
- `brain-write-path.ts` / `brain-retrieval.ts` / `brain-conflict-queue.ts` /
  `brain-forgetting.ts` / `brain-provenance.ts` — the persistence primitives
  `@infinite-ai/brain` builds its typed API on top of.
- `orchestrator.ts` / `approval.ts` — durable step-run and human-in-the-loop approval
  storage for `packages/orchestrator`.

## Where it fits

L3 (data plane) in the `CLAUDE.md` architecture — the second line of defence (RLS)
behind the first (every query going through `withTenant()`). Every layer above this one,
including `packages/brain` and `packages/orchestrator`, persists through primitives
exported from here rather than talking to Postgres directly.

## Running its tests

```bash
pnpm --filter @infinite-ai/db test                 # unit tier, no Docker needed
pnpm --filter @infinite-ai/db test:integration      # Testcontainers; real Postgres; no skip path
pnpm --filter @infinite-ai/db coverage:merged       # both tiers merged — the only honest number
```

The integration tier needs a Docker daemon. See the root `CLAUDE.md` for the local
Postgres + pgvector + Redis compose setup.
