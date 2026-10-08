import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rule 5: the only way this module reaches the database is `withTenant`, with exactly the
// tenant and actor it was given. And whatever happens, the header never shows a tenant id.
const { withTenant, readTenantName } = vi.hoisted(() => ({
  withTenant: vi.fn(),
  readTenantName: vi.fn(),
}));

vi.mock('@infinite-ai/db', () => ({ withTenant, readTenantName }));

import {
  FALLBACK_TENANT_LABEL,
  loadTenantLabel,
} from '../../src/lib/tenant-name-loader.js';

const SCOPE = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  actorId: '5b1a0000-0000-4000-8000-0000000000aa',
};
const TX = { tx: true };

describe('loadTenantLabel', () => {
  beforeEach(() => {
    withTenant.mockReset();
    readTenantName.mockReset();
    withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
  });

  it('reads the name inside the caller’s own tenant context', async () => {
    readTenantName.mockResolvedValue('Sunridge Primary');
    await expect(loadTenantLabel(SCOPE)).resolves.toBe('Sunridge Primary');
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: SCOPE.tenantId, actorId: SCOPE.actorId },
      expect.any(Function),
    );
    expect(readTenantName).toHaveBeenCalledWith(TX);
  });

  it('falls back to the product name when the tenant has no readable name', async () => {
    readTenantName.mockResolvedValue(null);
    await expect(loadTenantLabel(SCOPE)).resolves.toBe(FALLBACK_TENANT_LABEL);
  });

  it.each([
    ['tenant', { ...SCOPE, tenantId: '' }],
    ['actor', { ...SCOPE, actorId: '' }],
  ])('does not touch the database without a %s', async (_what, scope) => {
    await expect(loadTenantLabel(scope)).resolves.toBe(FALLBACK_TENANT_LABEL);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('keeps the shell up when the lookup fails, and never shows the tenant id', async () => {
    withTenant.mockRejectedValue(new Error('db down'));
    const label = await loadTenantLabel(SCOPE);
    expect(label).toBe(FALLBACK_TENANT_LABEL);
    expect(label).not.toContain(SCOPE.tenantId);
  });
});
