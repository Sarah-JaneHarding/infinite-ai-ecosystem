// @infinite-ai/telemetry — OpenTelemetry setup and the append-only audit ledger client.

export {
  buildChain,
  canonicalise,
  chainEvent,
  hashEvent,
  verifyChain,
  type AuditEventInput,
  type ChainProblem,
  type ChainVerification,
  type ChainedAuditEvent,
} from './audit.js';

export {
  createLogger,
  secret,
  type LogFields,
  type LogLevel,
  type LogLine,
  type Logger,
  type LoggerOptions,
  type Secret,
} from './logger.js';

export {
  createTracer,
  parseOtlpHeaders,
  NOOP_TRACER,
  type Span,
  type SpanAttributeValue,
  type Tracer,
  type TracerOptions,
} from './tracing.js';

export {
  ALERT_CATALOG,
  type AlertName,
  type AlertRule,
  type AlertSeverity,
} from './alerts.js';

export { scrubFields, scrubPii, PII_PATTERNS, type PiiPattern } from './log-scrub.js';

export { METRICS, METRIC_DIMS, type MetricName } from './metrics.js';

export {
  BURN_RATE_WINDOWS,
  SLO_CATALOG,
  TIME_TO_ARTEFACT_P95_MS,
  APPROVAL_QUEUE_AGE_MAX_MS,
  INGEST_FRESHNESS_MAX_MS,
  isBurning,
  monthlyErrorBudgetSeconds,
  type BurnRateWindow,
  type Slo,
  type SloTarget,
} from './slos.js';

export const PACKAGE_NAME = '@infinite-ai/telemetry' as const;
