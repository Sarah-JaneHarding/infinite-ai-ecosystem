import { describe, expect, it, vi } from 'vitest';

import type { TenantClient } from '../src/client.js';
import { findActiveUserAccountId } from '../src/user-account.js';

function clientReturning(row: { id: string } | null): {
  tx: TenantClient;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(row);
  return { tx: { userAccount: { findFirst } } as unknown as TenantClient, findFirst };
}

describe('findActiveUserAccountId', () => {
  it('returns the account id for the subject', async () => {
    const { tx, findFirst } = clientReturning({ id: 'acct-1' });
    await expect(findActiveUserAccountId(tx, 'sub-1')).resolves.toBe('acct-1');
    // Only ACTIVE accounts resolve, and only by subject — RLS supplies the tenant.
    expect(findFirst).toHaveBeenCalledWith({
      where: { subject: 'sub-1', status: 'ACTIVE' },
      select: { id: true },
    });
  });

  it('returns null when no active account has that subject', async () => {
    const { tx } = clientReturning(null);
    await expect(findActiveUserAccountId(tx, 'unknown')).resolves.toBeNull();
  });

  it('lets a database error through for the caller to decide', async () => {
    const tx = {
      userAccount: { findFirst: vi.fn().mockRejectedValue(new Error('db down')) },
    } as unknown as TenantClient;
    await expect(findActiveUserAccountId(tx, 'sub-1')).rejects.toThrow('db down');
  });
});
