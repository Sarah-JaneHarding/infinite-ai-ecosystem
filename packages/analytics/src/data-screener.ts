// AC-11 Analytics Data Screener rules — Stage 10 step 6.
//
// The pre-flight rules for a class, grade or school rollup, as a pure function: a snapshot
// in, `ready` / `suppressed` / `needs_input` out. No database, no model call, no clock. The
// caller supplies the `screenId`, which is what keeps the function deterministic.
//
// Check order is fixed: staleness → domain coverage → suppression → ready. A stale or empty
// snapshot says "supply fresher data" before it says anything about cohort size.
//
// The staleness threshold is the school's own (`input.staleAfterDays`); nothing here
// supplies a default.

import type { AC11Input, AC11Result } from './agent-schemas.js';
import { MIN_COHORT_SIZE } from './reporting.js';

export function screenRollup(input: AC11Input, screenId: string): AC11Result {
  if (input.mostRecentDataAgeInDays > input.staleAfterDays) {
    return { status: 'needs_input', detail: 'DATA_STALE' };
  }

  // A domain listed twice is still one domain.
  const coveredDomainCount = new Set(input.coveredDomains).size;
  if (coveredDomainCount === 0) {
    return { status: 'needs_input', detail: 'NO_DOMAIN_DATA' };
  }

  if (input.learnerCount < MIN_COHORT_SIZE || input.hasSuppressionFlag) {
    return {
      status: 'suppressed',
      screenId,
      reportScope: input.reportScope,
      scopeId: input.scopeId,
      termId: input.termId,
      learnerCount: input.learnerCount,
      // Both conditions at once reports the cohort size, as the prompt specifies.
      suppressionReason:
        input.learnerCount < MIN_COHORT_SIZE
          ? 'cohort_too_small'
          : 'sub_bucket_suppressed',
      evidenceIds: input.evidenceIds,
    };
  }

  return {
    status: 'ready',
    screenId,
    reportScope: input.reportScope,
    scopeId: input.scopeId,
    termId: input.termId,
    learnerCount: input.learnerCount,
    coveredDomainCount,
    evidenceIds: input.evidenceIds,
  };
}
