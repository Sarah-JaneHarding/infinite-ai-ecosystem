import { describe, it, expect } from 'vitest';

import { readRole, readRoles, rolesFromProfile } from '../../src/lib/session-role.js';

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

describe('rolesFromProfile', () => {
  const profile = (roles: unknown) => ({ realm_access: { roles } });

  it('reads the roles from realm_access.roles', () => {
    expect(rolesFromProfile(profile(['hod']))).toEqual(['hod']);
  });

  it('skips realm roles that are not ours', () => {
    expect(
      rolesFromProfile(profile(['offline_access', 'default-roles-infinite-ai', 'smt'])),
    ).toEqual(['smt']);
  });

  it('keeps every one of ours, in the provider’s order, each once — it does not pick one (OQ-032)', () => {
    expect(rolesFromProfile(profile(['learner', 'admin']))).toEqual(['learner', 'admin']);
    expect(rolesFromProfile(profile(['admin', 'learner', 'admin']))).toEqual([
      'admin',
      'learner',
    ]);
  });

  it('is empty — not teacher — when the account has none of our roles', () => {
    expect(
      rolesFromProfile(profile(['offline_access', 'default-roles-infinite-ai'])),
    ).toEqual([]);
    expect(rolesFromProfile(profile([]))).toEqual([]);
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
  ])('is empty for %s', (_name, p) => {
    expect(rolesFromProfile(p)).toEqual([]);
  });

  it('does not take a role from anywhere but realm_access.roles', () => {
    expect(rolesFromProfile({ role: 'admin', roles: ['admin'] })).toEqual([]);
  });
});

describe('readRoles', () => {
  it('accepts a list of our roles, including the empty list', () => {
    expect(readRoles(['teacher', 'hod'])).toEqual(['teacher', 'hod']);
    expect(readRoles([])).toEqual([]);
  });

  it.each([
    ['not an array', 'teacher'],
    ['undefined', undefined],
    ['null', null],
    ['an unknown element', ['teacher', 'nope']],
    ['a non-string element', ['teacher', 7]],
    ['a repeated role', ['teacher', 'teacher']],
  ])('is null for %s — a malformed list is not a shorter list', (_name, raw) => {
    expect(readRoles(raw)).toBeNull();
  });
});
