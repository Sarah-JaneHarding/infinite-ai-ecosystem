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

export const PACKAGE_NAME = '@infinite-ai/telemetry' as const;
