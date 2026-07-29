// @infinite-ai/policy — RBAC, consent, purpose limitation, retention, impersonation.
//
// Everything here is pure and synchronous: entries and a clock reading in, a verdict out.
// No database, no ambient time, no I/O. That is what makes the question that gets asked
// after the fact — "were we permitted to do this on the day we did it?" — a function call
// rather than an archaeology exercise.

export {
  endsProcessing,
  evaluateConsent,
  relevantEntries,
  unresolvedObjections,
  type ConsentQuery,
  type ConsentVerdict,
  type UnresolvedObjection,
} from './consent.js';

export {
  auditPayload,
  isEmpty,
  resolveAccess,
  type AccessAuditPayload,
  type AccessDecision,
  type AccessRequest,
  type DropReason,
  type DroppedCategory,
} from './access.js';

export const PACKAGE_NAME = '@infinite-ai/policy' as const;
