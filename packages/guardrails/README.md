# @infinite-ai/guardrails

Input/output validators, refusal policy, and the PII egress guard — the last thing
between the agent runtime and a model call. Rule 4 ("no learner personal information may
enter a prompt") is enforced here, not somewhere downstream that trusts the caller.

## What's here

- `pii-guard.ts` — `assertEgressAllowed()` / `inspectEgress()`, checked _provenance
  first_: a payload without a `deidentified: true` stamp is refused even when the
  detector finds nothing in it. There is no escape hatch.
- `input-checks.ts` — `checkInputSchema`, `checkPii`, `checkPurposeAndConsent`,
  `checkTokenBudget`: the pre-call gate a request passes through before it reaches a
  model.
- `output-checks.ts` — `checkGrounding`, `checkOutputSchema`, `checkReadability`,
  `checkRefusalPolicy`, `checkTemplateFidelity`, `checkAgeAppropriateness`,
  `checkDiagnosticLanguage`, `checkCost`: the post-call gate a model's response passes
  through before it reaches a human.
- `age-appropriateness-judge.ts` / `brain-age-appropriateness.ts` — the real,
  fail-closed age-appropriateness judge: it calls the Model Gateway and returns
  `appropriate: false` on any network error, non-2xx response, non-JSON reply, or schema
  mismatch, grounded only in the ratified developmental-readiness clauses
  `packages/brain` supplies for the call.
- `refusal.ts` — `Refusal`, `RefusalReasonCode`, `EscalationRoute`: the shared shape every
  guardrail failure reports through, so a refusal is always structured the same way
  regardless of which check produced it.
- `engine.ts` — `runInputGuardrails()` / `runOutputGuardrails()`, the orchestrator that
  runs every check in order and escalates via `EscalationNotifier` when one fails closed.

## Where it fits

L5 (the guardrail plane) in the `CLAUDE.md` architecture — directly below L6 (the agent
runtime) and above L4 (the Brain). No agent calls the Model Gateway without going through
`runInputGuardrails`/`runOutputGuardrails` first and last.

## Running its tests

```bash
pnpm --filter @infinite-ai/guardrails test
```

Unit tier only, no external services required — the age-appropriateness judge's gateway
call is exercised against a fake `JudgeGatewayCallFn`, not a real network call.
