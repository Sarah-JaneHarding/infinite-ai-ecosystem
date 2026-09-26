# @infinite-ai/provisioning

Tenant provisioning, the onboarding wizard's own state machine, lifecycle transitions,
and readiness scoring.

## What's here

- `wizard.ts` — `WIZARD_STEPS`/`REQUIRED_STEPS`, `computeReadinessScore()`,
  `isReadyForGoLive()`, `nextRequiredStep()`, and the per-step input schemas
  (`CreateTenantInputSchema`, `SchoolProfileInputSchema`, `ImportStaffInputSchema`,
  `ImportLearnersInputSchema`) the onboarding wizard validates each step against.
- `lifecycle.ts` — the tenant lifecycle state machine: `assertTransitionAllowed()`,
  `canSuspend()`/`canReactivate()`/`canClose()`, and `buildTransitionRecord()` for the
  audit trail each transition leaves.
- `readiness.ts` — `runReadinessChecks()`/`allReadinessChecksPassed()`, a broader
  pre-go-live check than the wizard's own step completion (real-world readiness: staff
  imported, learners imported, etc.).
- `pilot.ts` — `PILOT_COHORT`, the confirmed pilot schools tracked in
  `docs/PILOT_PROTOCOL.md`.

## Where it fits

An L7 module supporting `apps/web`'s `/admin/setup` onboarding flow. This package owns
the wizard's own step sequencing, readiness scoring, and the tenant's lifecycle once it's
live. Note for a future reader: `wizard.ts`'s own `SchoolProfileInputSchema` (lolt,
additional languages, term weeks, phase count) is a separate, lighter schema from
`@infinite-ai/school-setup`'s `LanguageSettings`/`TermWeeks` — the two packages do not
share types for what is conceptually the same "school profile" data, which is worth
resolving rather than treating as intentional duplication.

## Running its tests

```bash
pnpm --filter @infinite-ai/provisioning test
pnpm --filter @infinite-ai/provisioning test:coverage
```

Unit tier only, no external services required.
