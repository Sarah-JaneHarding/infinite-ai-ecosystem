import { beforeEach, describe, expect, it, vi } from 'vitest';

// The wrapper every admin route calls after a change commits. Its one promise: it never throws, because
// the administrator's action already succeeded and a provider problem is reported as state.
const h = vi.hoisted(() => ({
  getIdentityProvider: vi.fn(),
  reconcile: vi.fn(),
  withTenant: vi.fn(),
}));
vi.mock('../../src/lib/idp/provider', () => ({
  getIdentityProvider: h.getIdentityProvider,
}));
vi.mock('../../src/lib/idp/reconcile', () => ({
  reconcileIdentityProvider: h.reconcile,
}));
vi.mock('@infinite-ai/db', () => ({
  withTenant: h.withTenant,
  loadIdpAccountWork: vi.fn(),
  loadIdpInvitationWork: vi.fn(),
  recordAccountIdp: vi.fn(),
  recordInvitationIdp: vi.fn(),
  recordInvitationIdpUser: vi.fn(),
}));

import { syncIdentityProvider } from '../../src/lib/idp/sync';

const ACTOR = { tenantId: '10000000-0000-4000-8000-000000000001', actorId: 'acc-1' };

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
});

describe('syncIdentityProvider', () => {
  it('does nothing, and says so, when no provider is connected', async () => {
    h.getIdentityProvider.mockReturnValue(null);
    expect(await syncIdentityProvider(ACTOR)).toBeNull();
    expect(h.reconcile).not.toHaveBeenCalled();
  });

  it('reconciles this school, and returns the counts', async () => {
    const idp = { id: 'idp' };
    h.getIdentityProvider.mockReturnValue(idp);
    h.reconcile.mockResolvedValue({ synced: 2, failed: 1 });
    expect(await syncIdentityProvider(ACTOR)).toEqual({ synced: 2, failed: 1 });
    expect(h.reconcile).toHaveBeenCalledWith(idp, expect.anything(), ACTOR.tenantId);
  });

  it('never throws, whatever goes wrong underneath', async () => {
    h.getIdentityProvider.mockReturnValue({});
    h.reconcile.mockRejectedValue(
      new Error('database unreachable: victim@school.example'),
    );
    await expect(syncIdentityProvider(ACTOR)).resolves.toBeNull();
  });
});
