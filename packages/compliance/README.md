# @infinite-ai/compliance

Policy Compliance Engine — checks school operations against ratified South African
education policy sources, returning typed findings with clause-level citations. Every
finding cites the specific source document and section that creates the obligation; if a
rule has no `SourceRef`, it does not belong here (no invented rules).

## What's here

- `checks/{attendance,fees,conduct,sias,pd-points,wse}.ts` — one pure check function per
  compliance area, each taking already-typed input and producing `ComplianceFinding[]`.
- `engine.ts` — `runComplianceChecks()`, running every area's check against a single
  `ComplianceInput` and returning a combined `ComplianceReport`.
- `types.ts` — the Zod input schemas (`AttendanceInput`, `FeesInput`, `ConductInput`,
  `SiasInput`, `PdPointsInput`, `WseInput`, `ComplianceInput`) — the package's real
  input-validation boundary. The check functions themselves do no runtime validation of
  their own; a real caller validates untrusted data against these schemas first.

## Where it fits

An L7 module supporting MOD-02 (Support Analytics Centre). `packages/pd-journal`
produces the `PdCycleSummary` shape this package's `checkPdPoints` consumes directly; the
citations in every finding trace back to `packages/contracts`'s ratified policy sources
(SASA, BELA, SIAS, the WSE and PD-points schedules).

## Running its tests

```bash
pnpm --filter @infinite-ai/compliance test
pnpm --filter @infinite-ai/compliance test:coverage
```

Unit tier only, no external services required.
