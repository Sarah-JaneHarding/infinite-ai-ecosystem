// The tenant-scoped client's guard clauses.
//
// These need no database: validation happens before a connection is opened, which is
// itself the property under test. A malformed tenant id must be rejected before it can
// reach `set_config`, because from there it would become part of an RLS predicate.

import { describe, expect, it, vi } from 'vitest';

import { InvalidTenantContextError, withTenant } from '../src/client.js';

const VALID = '11111111-1111-4111-8111-111111111111';

describe('withTenant rejects a malformed context', () => {
  it('rejects a non-UUID tenantId', async () => {
    const fn = vi.fn();
    await expect(
      withTenant({ tenantId: 'not-a-uuid', actorId: VALID }, fn),
    ).rejects.toThrow(InvalidTenantContextError);
    expect(fn, 'the callback must not run').not.toHaveBeenCalled();
  });

  it('rejects a non-UUID actorId', async () => {
    const fn = vi.fn();
    await expect(withTenant({ tenantId: VALID, actorId: 'nobody' }, fn)).rejects.toThrow(
      InvalidTenantContextError,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects an empty tenantId', async () => {
    await expect(withTenant({ tenantId: '', actorId: VALID }, vi.fn())).rejects.toThrow(
      InvalidTenantContextError,
    );
  });

  it('rejects a SQL fragment dressed as a tenant id', async () => {
    // The values are passed as query parameters rather than interpolated, so this could
    // not inject even if it got through. Rejecting it early is defence in depth: the
    // check costs nothing and does not depend on every future caller using parameters.
    await expect(
      withTenant({ tenantId: "' OR '1'='1", actorId: VALID }, vi.fn()),
    ).rejects.toThrow(InvalidTenantContextError);
  });

  it('rejects a nil UUID, which is not a valid v1-v8 identifier', async () => {
    await expect(
      withTenant(
        { tenantId: '00000000-0000-0000-0000-000000000000', actorId: VALID },
        vi.fn(),
      ),
    ).rejects.toThrow(InvalidTenantContextError);
  });

  it('names the offending field, so the error is actionable', async () => {
    await expect(
      withTenant({ tenantId: 'bad', actorId: VALID }, vi.fn()),
    ).rejects.toThrow(/tenantId/);
    await expect(
      withTenant({ tenantId: VALID, actorId: 'bad' }, vi.fn()),
    ).rejects.toThrow(/actorId/);
  });
});
