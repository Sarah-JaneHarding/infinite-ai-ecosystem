# @infinite-ai/gateway

Model gateway service — the only egress point for model traffic. Rule 3 ("no model call
may bypass the Model Gateway") is what this app exists to be true; no provider SDK is
imported by application code anywhere else in the repo.

## What's here

- `index.ts` — `boot()`, wiring everything Stage 04 built into a running service:
  credential pools and adapters from the environment, the routing chain from a config
  file, budgets and cache in memory, and the HTTP surface in `server.ts`. Its own header
  comment is explicit about two real placeholders: cost estimation defaults to zero per
  call until real provider pricing is supplied (the same "ship no invented numbers"
  shape as the retention schedule template), and the tenant lexicon resolver's
  `actorId` is a fixed `GATEWAY_SERVICE_ACTOR_ID` system actor until Stage 06 wires
  through the real calling agent's identity.
- `adapters/` — one adapter per provider (`anthropic.ts`, `google.ts`,
  `openai-compatible.ts` for OpenAI and any local/self-hosted OpenAI-compatible model),
  plus `sse.ts` for streaming responses. These are the only files in the repo allowed to
  import a provider SDK.
- `routing/` — `router.ts`/`config.ts`: resolves a logical model name
  (`curriculum.plan`, `analytics.screen`, ...) to a real provider + model, with
  failover links.
- `credentials/pool.ts` — `CredentialPool`, rotating across multiple API keys per
  provider.
- `budgets/budget.ts` / `cache/cache.ts` — `BudgetTracker` (per-tenant cost limits) and
  `GatewayCache` (response caching).
- `circuit-breaker.ts` — opens after repeated provider failures, half-opens for a single
  trial after a cooldown.
- `config/env.ts` — this app's own Zod-validated environment loader (see
  `packages/config`'s README for why this app has its own rather than sharing one).

## Where it fits

L2 (the model gateway) in the `CLAUDE.md` architecture — directly above L0/L1
(the providers themselves) and below every layer that calls a model
(`apps/worker`, and through it every agent).

## Running it

```bash
pnpm --filter @infinite-ai/gateway test
pnpm --filter @infinite-ai/gateway test:coverage
```

Unit tier only — provider calls are exercised against a fake `FetchLike`, not real
provider endpoints.
