import { describe, expect, it, vi } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { readTenantName } from '../src/tenant-name.js';

function clientReturning(row: { name: string } | null): {
  tx: TenantClient;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(row);
  return { tx: { tenant: { findFirst } } as unknown as TenantClient, findFirst };
}

describe('readTenantName', () => {
  it('returns the name, trimmed, and asks for nothing else', async () => {
    const { tx, findFirst } = clientReturning({ name: '  Sunridge Primary ' });
    await expect(readTenantName(tx)).resolves.toBe('Sunridge Primary');
    // No id, no filter: RLS is what narrows this to the caller's own tenant.
    expect(findFirst).toHaveBeenCalledWith({ select: { name: true } });
  });

  it('returns null when the tenant row is not visible', async () => {
    const { tx } = clientReturning(null);
    await expect(readTenantName(tx)).resolves.toBeNull();
  });

  it('returns null for a blank name rather than an empty heading', async () => {
    const { tx } = clientReturning({ name: '   ' });
    await expect(readTenantName(tx)).resolves.toBeNull();
  });

  it('lets a database error through for the caller to decide', async () => {
    const tx = {
      tenant: { findFirst: vi.fn().mockRejectedValue(new Error('db down')) },
    } as unknown as TenantClient;
    await expect(readTenantName(tx)).rejects.toThrow('db down');
  });
});
