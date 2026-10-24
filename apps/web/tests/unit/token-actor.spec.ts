import { describe, it, expect } from 'vitest';

import { readTokenActor } from '../../src/lib/token-actor.js';

// OQ-033: an API route acts as the account resolved at sign-in. The OIDC `sub` is on the
// token too, and must never be taken for the actor.
const TENANT = '10000000-0000-4000-8000-000000000001';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';

describe('readTokenActor', () => {
  it('returns the tenant and the resolved account id', () => {
    expect(readTokenActor({ sub: SUB, tenantId: TENANT, userId: ACCOUNT })).toEqual({
      ok: true,
      actor: { tenantId: TENANT, actorId: ACCOUNT },
    });
  });

  it('refuses a token that carries only the provider subject', () => {
    expect(readTokenActor({ sub: SUB, tenantId: TENANT })).toEqual({
      ok: false,
      status: 403,
      error: 'No active account for this user',
    });
  });

  it('refuses an empty or non-string account id', () => {
    for (const userId of ['', 7, null]) {
      expect(readTokenActor({ sub: SUB, tenantId: TENANT, userId })).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });

  it('refuses a missing session with 401', () => {
    expect(readTokenActor(null)).toMatchObject({ ok: false, status: 401 });
    expect(readTokenActor(undefined)).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses a token with no tenant', () => {
    expect(readTokenActor({ sub: SUB, userId: ACCOUNT })).toMatchObject({
      ok: false,
      status: 403,
      error: 'No tenant context',
    });
  });
});
