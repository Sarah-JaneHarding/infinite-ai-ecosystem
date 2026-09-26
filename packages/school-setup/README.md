# @infinite-ai/school-setup

School onboarding configuration schemas — language settings, CAPS subjects,
grades/periods, term weeks, and staff. This is the data model behind the tenant
onboarding wizard's readiness score.

## What's here

- `types.ts` — `LanguageSettings` (LOLT/FAL/SAL, each drawn from `SA_LANGUAGES`),
  `TermWeeks`, `SubjectGradePeriods`, `StaffMember`, and `SchoolConfig` — the top-level,
  `.strict()` schema a fully-configured school satisfies (no unknown fields tolerated).
- `validate.ts` — `validateSchoolConfig(raw: unknown)`, the real untrusted-input
  boundary a caller (e.g. the onboarding wizard's API route) validates a submitted config
  against; plus `validateLanguageConflicts()` (a language cannot serve two roles at
  once) and small helpers (`periodsFromHours`, `totalWeeks`).

## Where it fits

An L7 module supporting the tenant onboarding flow described in
`docs/PILOT_PROTOCOL.md`. `GRADES_BY_PHASE`/`ALL_GRADES`/`CAPS_SUBJECTS` mirror the CAPS
framework in `packages/contracts`, so a school's declared subjects and grades stay
consistent with what the curriculum agents actually support.

## Running its tests

```bash
pnpm --filter @infinite-ai/school-setup test
pnpm --filter @infinite-ai/school-setup test:coverage
```

Unit tier only, no external services required.
