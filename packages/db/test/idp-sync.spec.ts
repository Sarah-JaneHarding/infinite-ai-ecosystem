import { describe, expect, it, vi } from 'vitest';

import {
  recordAccountIdp,
  recordInvitationIdp,
  requestInvitationIdpSync,
} from '../src/idp-sync.js';

// The guards that fire before any query: what may be written into the sync columns. The behaviour
// against a real database is `idp-sync.integration.spec.ts`.

const NOW = new Date('2026-11-13T08:00:00.000Z');
const noDatabase = (): never => {
  throw new Error('this must be refused before any query');
};
const tx = new Proxy({}, { get: noDatabase }) as never;

describe('what may be recorded as an error kind', () => {
  it.each([
    ['a sentence', 'Keycloak said no'],
    ['an address', 'victim@school.example'],
    ['upper case', 'Unavailable'],
    ['a digit', 'e500'],
    ['empty', ''],
    ['too long', 'a'.repeat(41)],
    ['a line break', 'unavailable\nsecret'],
  ])('refuses %s, before any query', async (_label, errorKind) => {
    await expect(
      recordInvitationIdp(tx, 'inv', { ok: false, errorKind }, null, NOW),
    ).rejects.toThrow(/token/);
    await expect(
      recordAccountIdp(tx, 'acc', { ok: false, errorKind }, NOW),
    ).rejects.toThrow(/token/);
  });

  it('would accept a token such as unavailable (it gets as far as the query)', async () => {
    await expect(
      recordAccountIdp(tx, 'acc', { ok: false, errorKind: 'unavailable' }, NOW),
    ).rejects.toThrow(/before any query/);
  });
});

describe('a synced invitation', () => {
  it('must name the identity-provider user, before any query', async () => {
    await expect(recordInvitationIdp(tx, 'inv', { ok: true }, null, NOW)).rejects.toThrow(
      /name its identity-provider user/,
    );
  });
});

describe('opting an invitation in', () => {
  it('only ever moves a NOT_MANAGED invitation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const fake = { userInvitation: { updateMany } } as never;
    expect(await requestInvitationIdpSync(fake, 'inv-1')).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', idpState: 'NOT_MANAGED' },
      data: { idpState: 'PENDING' },
    });
  });
});
