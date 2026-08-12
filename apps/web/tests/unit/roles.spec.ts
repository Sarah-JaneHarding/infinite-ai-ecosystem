import { describe, it, expect } from 'vitest';
import { ROLE_HOME, ROLE_LABEL, ROLE_NAV, roleCanViewPath } from '../../src/lib/roles.js';
import type { Role } from '@infinite-ai/policy';

const ALL_ROLES: readonly Role[] = [
  'teacher',
  'hod',
  'smt',
  'sbst',
  'admin',
  'guardian',
  'learner',
  'platform_support',
  'platform_admin',
];

describe('ROLE_HOME', () => {
  it('defines a home path for every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_HOME[role]).toMatch(/^\//);
    }
  });

  it('teacher home is /teacher', () => {
    expect(ROLE_HOME.teacher).toBe('/teacher');
  });

  it('platform roles share the same home', () => {
    expect(ROLE_HOME.platform_support).toBe(ROLE_HOME.platform_admin);
  });
});

describe('ROLE_LABEL', () => {
  it('defines a non-empty label for every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});

describe('ROLE_NAV', () => {
  it('defines at least one nav link for every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_NAV[role].length).toBeGreaterThan(0);
    }
  });

  it('all nav link hrefs start with /', () => {
    for (const role of ALL_ROLES) {
      for (const link of ROLE_NAV[role]) {
        expect(link.href).toMatch(/^\//);
      }
    }
  });
});

describe('roleCanViewPath', () => {
  it('allows a teacher to view /teacher', () => {
    expect(roleCanViewPath('teacher', '/teacher')).toBe(true);
  });

  it('allows a teacher to view /approvals', () => {
    expect(roleCanViewPath('teacher', '/approvals')).toBe(true);
  });

  it('does not allow a guardian to view /teacher', () => {
    expect(roleCanViewPath('guardian', '/teacher')).toBe(false);
  });

  it('does not allow a learner to view /hod', () => {
    expect(roleCanViewPath('learner', '/hod')).toBe(false);
  });

  it('allows an HoD to view /approvals', () => {
    expect(roleCanViewPath('hod', '/approvals')).toBe(true);
  });

  it('allows a platform_admin to view their home path', () => {
    expect(roleCanViewPath('platform_admin', ROLE_HOME.platform_admin)).toBe(true);
  });

  it('denies a learner access to /admin/prompts', () => {
    expect(roleCanViewPath('learner', '/admin/prompts')).toBe(false);
  });

  it('denies a teacher access to /platform/runs', () => {
    expect(roleCanViewPath('teacher', '/platform/runs')).toBe(false);
  });

  it('allows nested paths under a permitted root', () => {
    expect(roleCanViewPath('hod', '/approvals/a1b2c3')).toBe(true);
  });
});
