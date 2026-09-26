# @infinite-ai/telemetry

OpenTelemetry setup, the append-only audit ledger client, and the one sanctioned
structured logger — rule 12's forbidden-pattern ban on `console.log` in committed code
means every package logs through `createLogger()` here instead.

## What's here

- `audit.ts` — `chainEvent()` / `verifyChain()` / `hashEvent()`, the hash-chained,
  tamper-evident audit ledger primitives behind rule 4's append-only `audit_event` table.
- `logger.ts` — `createLogger()`, plus `secret()` to mark a field for redaction before it
  ever reaches a log line.
- `log-scrub.ts` — `scrubPii()` and `PII_PATTERNS` (SA ID, email, phone, payment-card),
  applied to every log line regardless of what the caller marked.
- `tracing.ts` — `createTracer()`, the OpenTelemetry span wrapper every gateway and Brain
  call is expected to emit a span through (Definition of Done: "Emits a trace span").
- `metrics.ts` / `slos.ts` / `alerts.ts` — `METRICS`, `SLO_CATALOG`, `ALERT_CATALOG`: the
  declarative tables behind `docs/RUNBOOKS` and the observability stage's burn-rate
  alerting.

## Where it fits

Stage 15 (observability, SLOs, DR) in `docs/STAGE_LOG.md`. Every layer in the
`CLAUDE.md` architecture — gateway, Brain, orchestrator, the modules — imports its
logger and tracer from here rather than instantiating its own, so a trace or a redaction
rule fixed once applies everywhere.

## Running its tests

```bash
pnpm --filter @infinite-ai/telemetry test
pnpm --filter @infinite-ai/telemetry test:trace-coverage   # span-emission contract
pnpm --filter @infinite-ai/telemetry test:log-scrub        # PII redaction patterns
```

Unit tier only, no external services required.
