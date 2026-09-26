# @infinite-ai/worker

BullMQ workers and the DAG runner host. This app is a wiring layer with no domain logic
of its own — all pipelines ship from `@infinite-ai/orchestrator`, all agent contracts
from `@infinite-ai/agents`; this app registers one BullMQ consumer per pipeline queue and
runs them to completion.

## What's here

- `index.ts` — `start()`, the entry point: builds the `WorkerHost`, wires the real
  age-appropriateness judge (a Model Gateway call, phase-scoped and fail-closed) and the
  real SNS safeguarding-escalation notifier when configured, registers every pipeline
  queue, and blocks until `SIGTERM`/`SIGINT` for a graceful drain.
- `worker-host.ts` — `WorkerHost`, the class tying a pipeline id to a BullMQ queue
  consumer and running each job through `@infinite-ai/orchestrator`'s `runToCompletion`.
- `step-executor.ts` — `createStepExecutor()`, the real `StepExecutor` the orchestrator
  calls for each step: loads the agent's prompt, POSTs to the Model Gateway, parses the
  reply, and — per its own header comment — runs only two of `@infinite-ai/guardrails`'
  checks directly (`checkAgeAppropriateness` always, `checkDiagnosticLanguage` when the
  contract declares `diagnosis_guard`), not the full `runInputGuardrails`/
  `runOutputGuardrails` engine — most of those checks need data this call site doesn't
  have yet (a citation set, a cost budget, a readability range, an established
  refusal-signalling convention).
- `tool-handlers.ts` — the real handler behind each tool an agent can call.
- `condition-evaluator.ts` — `evaluateCondition()`, resolving a pipeline branch's
  condition against a step's actual output.
- `approval.ts` — the human-in-the-loop gate's decision path — rule 6, enforced here.
- `sns-escalation-notifier.ts` — the real safeguarding escalation notifier (OQ-014),
  paging out via SNS when a guardrail refuses closed.
- `le-signal-trigger.ts` — triggers a Learning Engine signal pipeline run.
- `health-server.ts` — the liveness/readiness HTTP endpoint a container orchestrator
  polls.
- `queue-names.ts` — the one place every BullMQ queue name is declared, shared between
  the registration list in `index.ts` and anything that enqueues a job.

## Where it fits

The execution host for L6 (the agent runtime) in the `CLAUDE.md` architecture — the
process that actually runs every pipeline `@infinite-ai/orchestrator` defines, calling
out to L2 (`apps/gateway`) for every model call along the way.

## Running its tests

```bash
pnpm --filter @infinite-ai/worker test
```

Unit tier only — BullMQ, the gateway, and SNS are all exercised against fakes/mocks, not
real infrastructure.
