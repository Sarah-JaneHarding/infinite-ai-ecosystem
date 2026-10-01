import { describe, it, expect } from 'vitest';

import { readRole, roleFromProfile } from '../../src/lib/session-role.js';

describe('readRole', () => {
  it.each([
    'teacher',
    'hod',
    'smt',
    'sbst',
    'admin',
    'guardian',
    'learner',
    'platform_support',
    'platform_admin',
  ])('accepts %s', (role) => {
    expect(readRole(role)).toBe(role);
  });

  it.each([
    undefined,
    null,
    '',
    'Teacher',
    ' teacher',
    'teacher ',
    'superuser',
    'default-roles-infinite-ai',
    0,
    {},
    ['teacher'],
  ])('is null for %j — there is no default role', (raw) => {
    expect(readRole(raw)).toBeNull();
  });
});

describe('roleFromProfile', () => {
  const profile = (roles: unknown) => ({ realm_access: { roles } });

  it('reads the role from realm_access.roles', () => {
    expect(roleFromProfile(profile(['hod']))).toBe('hod');
  });

  it('skips realm roles that are not ours', () => {
    expect(
      roleFromProfile(profile(['offline_access', 'default-roles-infinite-ai', 'smt'])),
    ).toBe('smt');
  });

  it('takes the first of our roles when an account holds several (OQ-032)', () => {
    expect(roleFromProfile(profile(['learner', 'admin']))).toBe('learner');
    expect(roleFromProfile(profile(['admin', 'learner']))).toBe('admin');
  });

  it('is null — not teacher — when the account has none of our roles', () => {
    expect(
      roleFromProfile(profile(['offline_access', 'default-roles-infinite-ai'])),
    ).toBeNull();
    expect(roleFromProfile(profile([]))).toBeNull();
  });

  it.each([
    ['no profile', undefined],
    ['null profile', null],
    ['a string profile', 'teacher'],
    ['no realm_access', {}],
    ['realm_access a string', { realm_access: 'teacher' }],
    ['realm_access null', { realm_access: null }],
    ['roles missing', { realm_access: {} }],
    ['roles a string', { realm_access: { roles: 'teacher' } }],
    ['roles not strings', { realm_access: { roles: [1, null, {}] } }],
  ])('is null for %s', (_name, p) => {
    expect(roleFromProfile(p)).toBeNull();
  });

  it('does not take a role from anywhere but realm_access.roles', () => {
    expect(roleFromProfile({ role: 'admin', roles: ['admin'] })).toBeNull();
  });
});
