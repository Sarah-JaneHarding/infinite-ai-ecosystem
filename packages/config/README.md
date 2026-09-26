# @infinite-ai/config

Zod-validated environment loader. Rule 8's forbidden-pattern list bans
`process.env outside packages/config`, enforced by ESLint — every package other than the
two apps with their own mirrored, app-specific loader (`apps/gateway/src/config/env.ts`,
`apps/web/src/lib/env.ts`) reads its configuration through this one.

## What's here

- `env.ts` — `EnvSchema`, `loadEnv()` / `parseEnv()`, and `EnvironmentValidationError`
  thrown on a missing or malformed variable. `NodeEnv` and `Region` are the two enums
  most other schemas key off.
- `flags.ts` — the feature-flag registry: `FLAGS`, `isEnabled()`, and `expiredFlags()`,
  which `scripts/check-feature-flags.ts` uses to fail CI on a flag past its expiry date.

## Where it fits

L0/L1 of the architecture in the root `CLAUDE.md` — every layer above this one (the data
plane, the guardrail plane, the agent runtime, the modules) reads its configuration
through `loadEnv()` rather than `process.env` directly, so a missing secret fails fast at
startup instead of surfacing as an obscure runtime error three layers up.

## Running its tests

```bash
pnpm --filter @infinite-ai/config test
```

Unit tier only, no external services required.
