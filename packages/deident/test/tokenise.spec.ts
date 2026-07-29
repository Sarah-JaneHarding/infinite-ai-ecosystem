// Tokenisation — the three properties a pseudonym must have to be one.

import { describe, expect, it } from 'vitest';

import {
  TenantSalt,
  TokenisationError,
  isToken,
  tokenMatches,
  tokenise,
} from '../src/tokenise.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const LEARNER = '33333333-3333-4333-8333-333333333333';

const saltA = TenantSalt.generateForTesting(1);
const saltB = TenantSalt.fromBase64(Buffer.alloc(32, 9).toString('base64'), 1);

describe('deterministic within a tenant', () => {
  it('gives the same learner the same token every time', () => {
    // Without this the Brain cannot accumulate history about anyone, because yesterday's
    // token and today's would be different people.
    expect(tokenise('learner', LEARNER, TENANT_A, saltA).value).toBe(
      tokenise('learner', LEARNER, TENANT_A, saltA).value,
    );
  });

  it('gives different subjects different tokens', () => {
    const other = '44444444-4444-4444-8444-444444444444';
    expect(tokenise('learner', LEARNER, TENANT_A, saltA).value).not.toBe(
      tokenise('learner', other, TENANT_A, saltA).value,
    );
  });

  it('separates subject kinds, so a learner and a guardian never collide', () => {
    expect(tokenise('learner', LEARNER, TENANT_A, saltA).value).not.toBe(
      tokenise('guardian', LEARNER, TENANT_A, saltA).value,
    );
  });
});

describe('unlinkable across tenants', () => {
  it('gives the same subject different tokens under different salts', () => {
    expect(tokenise('learner', LEARNER, TENANT_A, saltA).value).not.toBe(
      tokenise('learner', LEARNER, TENANT_A, saltB).value,
    );
  });

  it('gives the same subject different tokens under different tenant ids', () => {
    // Belt and braces alongside the salt: even if two tenants were ever misconfigured
    // onto the same salt, their tokens still diverge. Otherwise the commons becomes a
    // cross-school identity graph.
    expect(tokenise('learner', LEARNER, TENANT_A, saltA).value).not.toBe(
      tokenise('learner', LEARNER, TENANT_B, saltA).value,
    );
  });
});

describe('salt handling', () => {
  it('refuses a salt shorter than 32 bytes', () => {
    // A short salt is a guessable salt, and a guessable salt makes every token reversible
    // by anyone holding the database.
    expect(() =>
      TenantSalt.fromBase64(Buffer.alloc(16, 1).toString('base64'), 1),
    ).toThrow(TokenisationError);
  });

  it('refuses a non-positive version', () => {
    expect(() =>
      TenantSalt.fromBase64(Buffer.alloc(32, 1).toString('base64'), 0),
    ).toThrow(TokenisationError);
  });

  it('carries the salt version on every token, so rotation is detectable', () => {
    const v2 = TenantSalt.generateForTesting(2);
    expect(tokenise('learner', LEARNER, TENANT_A, v2).saltVersion).toBe(2);
  });

  it('refuses to tokenise an empty subject id', () => {
    expect(() => tokenise('learner', '', TENANT_A, saltA)).toThrow(TokenisationError);
  });
});

describe('token format', () => {
  it('matches the documented shape', () => {
    const token = tokenise('learner', LEARNER, TENANT_A, saltA);
    expect(token.value).toMatch(/^LNR_[0-9A-F]{12}$/);
    expect(isToken(token.value)).toBe(true);
  });

  it('uses the right prefix per kind', () => {
    expect(tokenise('guardian', LEARNER, TENANT_A, saltA).value.startsWith('GDN_')).toBe(
      true,
    );
    expect(tokenise('staff', LEARNER, TENANT_A, saltA).value.startsWith('STF_')).toBe(
      true,
    );
    expect(tokenise('class', LEARNER, TENANT_A, saltA).value.startsWith('CLS_')).toBe(
      true,
    );
  });

  it('rejects things that are not tokens', () => {
    for (const value of ['LNR_abc', 'Nomvula', 'LNR_7F3A2C0', '', 'XXX_7F3A2C0000']) {
      expect(isToken(value), `${value} should not be a token`).toBe(false);
    }
  });
});

describe('confirming a claimed mapping', () => {
  it('matches the right subject', () => {
    const token = tokenise('learner', LEARNER, TENANT_A, saltA);
    expect(tokenMatches(token, 'learner', LEARNER, TENANT_A, saltA)).toBe(true);
  });

  it('does not match a different subject', () => {
    const token = tokenise('learner', LEARNER, TENANT_A, saltA);
    const other = '44444444-4444-4444-8444-444444444444';
    expect(tokenMatches(token, 'learner', other, TENANT_A, saltA)).toBe(false);
  });

  it('does not match under a different tenant', () => {
    const token = tokenise('learner', LEARNER, TENANT_A, saltA);
    expect(tokenMatches(token, 'learner', LEARNER, TENANT_B, saltA)).toBe(false);
  });
});
