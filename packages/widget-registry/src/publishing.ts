// Publishing rules (OQ-037, OQ-039): a public widget carries no school-specific information and is
// reviewed by the platform before any other school sees it.

import type { Actor } from './types.js';

export type Visibility = 'private' | 'public';

export type OfferStatus =
  | 'ratified_private'
  | 'submitted_for_platform_review'
  | 'platform_approved'
  | 'platform_rejected';

export interface OfferFacts {
  readonly visibility: Visibility;
  /** The school confirmed, through a named SMT member, that school-specific information was removed. */
  readonly schoolInfoRemoved: boolean;
  readonly platformApproved: boolean;
}

export type OfferCheck =
  | { ok: true }
  | { ok: false; code: 'SCHOOL_INFO_NOT_REMOVED' | 'PUBLIC_NEEDS_PLATFORM_REVIEW' };

/** May other schools be shown this widget? Private never; public only when cleaned and platform-approved. */
export function mayOfferToOtherSchools(o: OfferFacts): OfferCheck {
  if (o.visibility === 'private')
    return { ok: false, code: 'PUBLIC_NEEDS_PLATFORM_REVIEW' };
  if (!o.schoolInfoRemoved) return { ok: false, code: 'SCHOOL_INFO_NOT_REMOVED' };
  if (!o.platformApproved) return { ok: false, code: 'PUBLIC_NEEDS_PLATFORM_REVIEW' };
  return { ok: true };
}

/** What a newly submitted offer's status is. */
export function submitStatus(v: Visibility): OfferStatus {
  return v === 'public' ? 'submitted_for_platform_review' : 'ratified_private';
}

/** The decision of an Infinite-AI appointed reviewer on a public offer (OQ-039). */
export interface PlatformReview {
  readonly reviewer: Actor;
  readonly decision: 'approved' | 'rejected';
  readonly reason: string;
  readonly at: string;
}

export type ReviewCheck =
  | { ok: true; status: OfferStatus }
  | {
      ok: false;
      code: 'REVIEWER_NOT_APPOINTED' | 'ACCOUNT_REQUIRED' | 'REASON_REQUIRED';
    };

/**
 * Only an Infinite-AI appointed reviewer, acting as a signed-in account, may approve or reject a public
 * offer, and must give a reason. `appointedAccountIds` is the platform's list; the school cannot supply it.
 */
export function applyPlatformReview(
  r: PlatformReview,
  appointedAccountIds: readonly string[],
): ReviewCheck {
  if (!r.reviewer.accountId) return { ok: false, code: 'ACCOUNT_REQUIRED' };
  if (!appointedAccountIds.includes(r.reviewer.accountId))
    return { ok: false, code: 'REVIEWER_NOT_APPOINTED' };
  if (!r.reason.trim()) return { ok: false, code: 'REASON_REQUIRED' };
  return {
    ok: true,
    status: r.decision === 'approved' ? 'platform_approved' : 'platform_rejected',
  };
}
