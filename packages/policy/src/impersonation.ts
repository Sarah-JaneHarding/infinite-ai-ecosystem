// Support impersonation — Stage 02 step 7.
//
// "Time-boxed, reason-required, tenant-approved, loudly banner-flagged in the UI, and
// always audited."
//
// Impersonation is the one sanctioned route by which platform staff touch a school's data,
// which makes it the most dangerous feature in the product and the one most likely to be
// quietly widened for convenience. Each constraint below is therefore expressed as a
// construction-time requirement rather than a check performed later: a session that lacks
// a reason or an expiry cannot be built, so there is no state in which one exists
// unnoticed.

import { z } from 'zod';

/** Maximum life of a session, regardless of what was requested. */
export const MAX_DURATION_MINUTES = 240;

/** How long a tenant's approval stays usable before it must be sought again. */
export const APPROVAL_VALIDITY_HOURS = 24;

export const ImpersonationRequest = z.object({
  /** The platform user asking. */
  actorId: z.string().uuid(),
  tenantId: z.string().uuid(),
  /**
   * Why. Free text with a floor, because "support" is not a reason and a reason nobody
   * can read afterwards is the same as none.
   */
  reason: z.string().trim().min(20, 'A reason must be specific enough to audit.'),
  /** Optional link to the support ticket that prompted it. */
  ticketRef: z.string().nullable(),
  requestedMinutes: z.number().int().positive().max(MAX_DURATION_MINUTES),
});
export type ImpersonationRequest = z.infer<typeof ImpersonationRequest>;

/** A tenant administrator's approval. Impersonation cannot start without one. */
export const TenantApproval = z.object({
  approvedByUserId: z.string().uuid(),
  approvedAt: z.date(),
  tenantId: z.string().uuid(),
});
export type TenantApproval = z.infer<typeof TenantApproval>;

export const ImpersonationSession = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  tenantId: z.string().uuid(),
  reason: z.string().min(20),
  ticketRef: z.string().nullable(),
  startedAt: z.date(),
  expiresAt: z.date(),
  approvedByUserId: z.string().uuid(),
  endedAt: z.date().nullable(),
});
export type ImpersonationSession = z.infer<typeof ImpersonationSession>;

export type StartResult =
  | { readonly ok: true; readonly session: ImpersonationSession }
  | { readonly ok: false; readonly reason: StartRefusal };

export type StartRefusal =
  | 'reason_too_vague'
  | 'no_tenant_approval'
  | 'approval_for_different_tenant'
  | 'approval_expired'
  | 'duration_exceeds_maximum';

/**
 * Starts a session, or refuses with a reason.
 *
 * Returns a result rather than throwing: a refusal here is an ordinary outcome the support
 * UI renders, not an exception. Throwing would invite a `catch` that swallows it.
 */
export function startImpersonation(
  request: ImpersonationRequest,
  approval: TenantApproval | null,
  sessionId: string,
  now: Date = new Date(),
): StartResult {
  const parsed = ImpersonationRequest.safeParse(request);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path.includes('requestedMinutes'));
    return {
      ok: false,
      reason: tooLong ? 'duration_exceeds_maximum' : 'reason_too_vague',
    };
  }

  if (approval === null) return { ok: false, reason: 'no_tenant_approval' };
  if (approval.tenantId !== request.tenantId) {
    // An approval for tenant A must never authorise entry to tenant B, however the call
    // site assembled the pair.
    return { ok: false, reason: 'approval_for_different_tenant' };
  }

  const approvalAgeHours = (now.getTime() - approval.approvedAt.getTime()) / 3_600_000;
  if (approvalAgeHours > APPROVAL_VALIDITY_HOURS || approvalAgeHours < 0) {
    return { ok: false, reason: 'approval_expired' };
  }

  return {
    ok: true,
    session: {
      id: sessionId,
      actorId: request.actorId,
      tenantId: request.tenantId,
      reason: request.reason.trim(),
      ticketRef: request.ticketRef,
      startedAt: now,
      expiresAt: new Date(now.getTime() + request.requestedMinutes * 60_000),
      approvedByUserId: approval.approvedByUserId,
      endedAt: null,
    },
  };
}

/**
 * Is this session currently usable?
 *
 * Checked on every request rather than at start only. A session that has expired mid-task
 * must stop working immediately — the alternative is a support engineer keeping a tab open
 * and retaining access for a week.
 */
export function isSessionActive(
  session: ImpersonationSession,
  now: Date = new Date(),
): boolean {
  if (session.endedAt !== null) return false;
  return session.expiresAt.getTime() > now.getTime();
}

/** Ends a session early. Idempotent — ending an ended session keeps the original time. */
export function endImpersonation(
  session: ImpersonationSession,
  now: Date = new Date(),
): ImpersonationSession {
  return session.endedAt === null ? { ...session, endedAt: now } : session;
}

/**
 * What the UI must display while a session is active.
 *
 * The manual requires the banner to be loud. Returning its content from the policy package
 * rather than leaving it to the front end means a redesign cannot quietly soften it into a
 * subtle grey notice, which is the natural fate of any warning owned by whoever is trying
 * to make a screen look calm.
 */
export function impersonationBanner(session: ImpersonationSession): {
  severity: 'critical';
  message: string;
  expiresAt: Date;
} {
  return {
    severity: 'critical',
    message:
      `You are viewing this school's data as platform support. ` +
      `Every action is recorded against you. Reason: ${session.reason}`,
    expiresAt: session.expiresAt,
  };
}
