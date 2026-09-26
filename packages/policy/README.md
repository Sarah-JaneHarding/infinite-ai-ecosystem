# @infinite-ai/policy

RBAC, consent, purpose limitation, retention, and impersonation. Everything here is pure
and synchronous — a grant, a set of ledger entries and a clock reading in, a verdict out.
No database, no ambient time, no I/O. That is what makes "were we permitted to do this on
the day we did it?" answerable as a function call rather than an archaeology exercise.

## What's here

- `rbac.ts` — `PERMISSIONS`, the declarative RBAC matrix; `authorize()` /
  `assertAuthorized()`. `NEVER_GRANTED_VIA_RBAC` names the actions RBAC alone can never
  grant — access to identifiable learner data still needs a purpose and a lawful basis,
  which is rule 3 in `access.ts` below.
- `access.ts` — `resolveAccess()`, the fixed-order gate: tombstone → purpose allow-list →
  lawful basis. Purpose is checked _before_ consent on purpose — consent cannot widen a
  use the school never declared.
- `consent.ts` — `evaluateConsent()`, effective consent derived by replaying the
  append-only `consent_record` ledger rather than reading a mutable "current consent"
  flag.
- `impersonation.ts` — `startImpersonation()` / `endImpersonation()`, the platform-support
  break-glass flow: time-boxed (`MAX_DURATION_MINUTES`), tenant-approved, and always
  bannered while active (`impersonationBanner()`).

## Where it fits

L5 (the guardrail plane) in the `CLAUDE.md` architecture, alongside `packages/guardrails`
and `packages/deident`. `packages/contracts` defines what a `Purpose` or a `Role` _is_;
this package decides what a given actor, resource, and purpose combination is _allowed to
do_ with it — the same three-gate order every caller relies on.

## Running its tests

```bash
pnpm --filter @infinite-ai/policy test
```

Unit tier only — every function here is pure, so there is no integration tier.
