# @infinite-ai/security

Security primitives: HTTP response headers (including CSP with a per-request nonce),
CSRF double-submit tokens, per-tenant sliding-window rate limiting, quota enforcement,
and the agent tool allow-list / output-safety check.

## What's here

- `headers.ts` — `buildCsp()`, `generateNonce()`, `buildResponseHeaders()`.
- `csrf.ts` — `generateCsrfToken()` / `validateCsrfToken()`, double-submit cookie pattern.
- `rate-limit.ts` — `checkRateLimit()`, a sliding-window limiter with a stricter
  `RESTRICTED_RATE_LIMIT` tier for sensitive routes.
- `quota.ts` — `checkQuota()` and `QUOTA_TIERS`, the per-tenant billing-tier token/request
  budget enforcement referenced in `docs/COST_MODEL.md`.
- `agent-surface.ts` — `isToolAllowed()` (per-agent tool allow-lists) and
  `isOutputSafe()` / `findUnsafePattern()`, the output-safety scan every agent response
  passes through before it reaches a human.

## Where it fits

Stage 16 (security hardening) in `docs/STAGE_LOG.md`. `apps/web`'s middleware
(`src/proxy.ts`) calls into `headers.ts` and `csrf.ts` on every request; the orchestrator
and gateway call into `rate-limit.ts`/`quota.ts` per tenant and `agent-surface.ts` per
agent invocation — this package is a set of pure functions with no I/O of its own, so the
callers own persisting rate-limit/quota state between calls.

## Running its tests

```bash
pnpm --filter @infinite-ai/security test
pnpm --filter @infinite-ai/security test:tenant-abuse   # rate-limit + quota only
```

Unit tier only, no external services required.
