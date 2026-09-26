# @infinite-ai/web

Next.js app — every role-scoped experience surface: teacher, HoD, SMT, SBST, admin,
guardian, learner, platform support/admin, and district.

## What's here

- `src/app/(shell)/` — one route segment per role (`teacher/`, `hod/`, `smt/`, `sbst/`,
  `admin/`, `guardian/`, `learner/`, `platform/`, `district/`), plus `approvals/`, shared
  across the school roles.
- `src/app/api/` — the app's own API routes (e.g. the `caps-canon` ingest/ratify admin
  surface backed by `@infinite-ai/curriculum-seed`).
- `src/proxy.ts` — the Next.js middleware: CSP nonce generation, and redirecting an
  unauthenticated request to a protected route to `/sign-in`.
- `src/lib/roles.ts` — `ROLE_HOME`/`ROLE_LABEL`/`ROLE_NAV` per role, and
  `roleCanViewPath()`, the RBAC gate this app's routing relies on.
- `src/lib/env.ts` — this app's own Zod-validated environment loader (mirrors the
  pattern in `apps/gateway/src/config/env.ts`; see `packages/config`'s README for why
  both apps have their own).
- `src/auth.ts` — NextAuth/Keycloak wiring.

## Where it fits

L8 (experience surfaces) in the `CLAUDE.md` architecture — the top of the stack. Composes
its UI from `@infinite-ai/design-system` and reads/writes through the same
`@infinite-ai/db`/`@infinite-ai/policy` boundaries every other layer respects; there is
no direct database access that bypasses the tenant-scoped client.

## Running it

```bash
pnpm --filter web dev            # local dev server
pnpm --filter web test           # unit tier only — vitest.config.ts excludes e2e/a11y
pnpm --filter web test:e2e       # Playwright, needs a running app
pnpm --filter web test:a11y      # Playwright, @a11y-tagged specs only
pnpm --filter web test:lighthouse
pnpm --filter web build
```
