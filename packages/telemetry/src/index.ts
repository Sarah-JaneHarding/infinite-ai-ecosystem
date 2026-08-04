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

export const PACKAGE_NAME = '@infinite-ai/telemetry' as const;
