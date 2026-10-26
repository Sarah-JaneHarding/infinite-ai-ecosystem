// Publishing rules (OQ-037, OQ-039): a public widget carries no school-specific information and is
// reviewed by the platform before any other school sees it.

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
