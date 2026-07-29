// @infinite-ai/guardrails — input/output validators, refusal policy, PII egress guard.

export {
  PiiEgressError,
  assertEgressAllowed,
  inspectEgress,
  type DeidentificationProvenance,
  type EgressPayload,
  type EgressRefusal,
  type EgressVerdict,
} from './pii-guard.js';

export const PACKAGE_NAME = '@infinite-ai/guardrails' as const;
