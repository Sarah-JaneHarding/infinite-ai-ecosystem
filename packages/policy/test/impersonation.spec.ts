// Support impersonation — Stage 02 step 7 and the exit gate's "impersonation cannot be
// started without a stored reason and an expiry".

import { describe, expect, it } from 'vitest';

import {
  APPROVAL_VALIDITY_HOURS,
  MAX_DURATION_MINUTES,
  endImpersonation,
  impersonationBanner,
  isSessionActive,
  startImpersonation,
  type ImpersonationRequest,
  type TenantApproval,
} from '../src/impersonation.js';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const TENANT = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT = '33333333-3333-4333-8333-333333333333';
const APPROVER = '44444444-4444-4444-8444-444444444444';
const SESSION = '55555555-5555-4555-8555-555555555555';
const NOW = new Date('2026-07-29T10:00:00Z');

const request = (over: Partial<ImpersonationRequest> = {}): ImpersonationRequest => ({
  actorId: ACTOR,
  tenantId: TENANT,
  reason: 'Investigating ticket 4821: term plans failing to export to PDF.',
  ticketRef: 'SUP-4821',
  requestedMinutes: 60,
  ...over,
});

const approval = (over: Partial<TenantApproval> = {}): TenantApproval => ({
  approvedByUserId: APPROVER,
  approvedAt: new Date('2026-07-29T09:30:00Z'),
  tenantId: TENANT,
  ...over,
});

describe('a session cannot start without its preconditions', () => {
  it('starts with a specific reason and a valid approval', () => {
    const result = startImpersonation(request(), approval(), SESSION, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.reason).toContain('ticket 4821');
      expect(result.session.expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(result.session.approvedByUserId).toBe(APPROVER);
    }
  });

  it('refuses a vague reason', () => {
    // "support" is not a reason. The floor is a length, which is crude, but a reason
    // nobody can read afterwards is the same as no reason at all.
    const result = startImpersonation(
      request({ reason: 'support' }),
      approval(),
      SESSION,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('reason_too_vague');
  });

  it('refuses whitespace padded to look like a reason', () => {
    const result = startImpersonation(
      request({ reason: '                              ' }),
      approval(),
      SESSION,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('reason_too_vague');
  });

  it('refuses without any tenant approval', () => {
    const result = startImpersonation(request(), null, SESSION, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_tenant_approval');
  });

  it('refuses an approval belonging to a different tenant', () => {
    // However the call site assembled the pair, an approval for one school must never
    // open the door to another.
    const result = startImpersonation(
      request(),
      approval({ tenantId: OTHER_TENANT }),
      SESSION,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('approval_for_different_tenant');
  });

  it('refuses a stale approval', () => {
    const stale = approval({
      approvedAt: new Date(NOW.getTime() - (APPROVAL_VALIDITY_HOURS + 1) * 3_600_000),
    });
    const result = startImpersonation(request(), stale, SESSION, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('approval_expired');
  });

  it('refuses an approval dated in the future', () => {
    // A clock-skew or forged approval should not buy extra validity.
    const future = approval({ approvedAt: new Date(NOW.getTime() + 3_600_000) });
    const result = startImpersonation(request(), future, SESSION, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('approval_expired');
  });

  it('refuses a duration beyond the maximum', () => {
    const result = startImpersonation(
      request({ requestedMinutes: MAX_DURATION_MINUTES + 1 }),
      approval(),
      SESSION,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duration_exceeds_maximum');
  });

  it('always sets an expiry — there is no unbounded session', () => {
    const result = startImpersonation(
      request({ requestedMinutes: 1 }),
      approval(),
      SESSION,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.expiresAt).toEqual(new Date(NOW.getTime() + 60_000));
    }
  });
});

describe('a session stops working when it should', () => {
  const started = startImpersonation(request(), approval(), SESSION, NOW);
  const session = started.ok ? started.session : null;

  it('is active before expiry', () => {
    expect(isSessionActive(session!, new Date(NOW.getTime() + 59 * 60_000))).toBe(true);
  });

  it('is inactive after expiry', () => {
    // Checked per request, not only at start. Otherwise a support engineer keeps a tab
    // open and keeps access for a week.
    expect(isSessionActive(session!, new Date(NOW.getTime() + 61 * 60_000))).toBe(false);
  });

  it('is inactive once ended, even before expiry', () => {
    const ended = endImpersonation(session!, new Date(NOW.getTime() + 60_000));
    expect(isSessionActive(ended, new Date(NOW.getTime() + 2 * 60_000))).toBe(false);
  });

  it('keeps the original end time when ended twice', () => {
    const first = endImpersonation(session!, new Date(NOW.getTime() + 60_000));
    const second = endImpersonation(first, new Date(NOW.getTime() + 120_000));
    expect(second.endedAt).toEqual(first.endedAt);
  });
});

describe('the banner', () => {
  it('is critical, names the reason, and states when access ends', () => {
    // Owned by the policy package rather than the front end, so a redesign cannot soften
    // it into a subtle grey notice — the natural fate of any warning owned by whoever is
    // trying to make a screen look calm.
    const started = startImpersonation(request(), approval(), SESSION, NOW);
    expect(started.ok).toBe(true);
    if (started.ok) {
      const banner = impersonationBanner(started.session);
      expect(banner.severity).toBe('critical');
      expect(banner.message).toContain('ticket 4821');
      expect(banner.message).toContain('recorded against you');
      expect(banner.expiresAt).toEqual(started.session.expiresAt);
    }
  });
});
