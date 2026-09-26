# @infinite-ai/warehouse

MOD-03 Data Collection & Warehouse: ingestion, schema mapping, quality checking,
Learner-360 profiles, and insight synthesis.

## What's here

- `types.ts` — the domain types and Zod schemas shared across every step below
  (`AttendanceSummary`, `Learner360Profile`, `QualityIssue`, `Insight`, `NextStep`, ...).
- `ingest/connector.ts` — the `IngestConnector` interface and its real implementations
  (`SisApiConnector`, `AttendanceApiConnector`, `BehaviourApiConnector`,
  `ScreenerApiConnector`, `CsvFileConnector`, `ManualUploadConnector`), plus
  `getConnector()` to resolve one by `ConnectorKind`.
- `ingest/csv-parser.ts` — `parseCsv()`, the shared CSV parsing behind
  `CsvFileConnector` and `ManualUploadConnector`.
- `mapping/schema-mapper.ts` — `mapRecord()`, translating a school's own source-system
  field names to the warehouse's conformed schema via a `FieldMapping`/`TransformRegistry`.
- `quality/quality-sentinel.ts` — `runQualityChecks()`, flagging a `QualityIssue` (by
  `QualityIssueKind`) in ingested data before it reaches Learner-360.
- `learner360/learner360-builder.ts` — `buildLearner360()`, materialising a single
  learner's cross-domain profile from conformed events.
- `insight/insight-synthesiser.ts` / `nextstep/nextstep-recommender.ts` —
  `synthesiseInsight()`/`recommendNextStep()`, both taking a pluggable model adapter
  (`InsightModelAdapter`/`NextStepModelAdapter`) rather than calling a model directly —
  the actual model call happens through the Model Gateway, one layer up.
- `agent-inputs.ts` — the `DW01Input` … `DW08Input`/`Result` shapes for MOD-03's eight
  agents.

## Where it fits

The L7 module directly implementing MOD-03. `packages/agents/src/mod-03/`'s eight
`DW-*.contract.ts` declarations are the real consumers of this package's types today,
along with `scripts/register-dw-executors.ts`. This package owns collection and
conformance, not the tier or SIAS decisions `@infinite-ai/analytics` (MOD-02) makes from
data that eventually reaches it.

## Running its tests

```bash
pnpm --filter @infinite-ai/warehouse test
```

Unit tier only — connectors are exercised against fixture data/fakes, not live source
systems.
