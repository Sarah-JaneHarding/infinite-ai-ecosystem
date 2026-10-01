import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Role } from '@infinite-ai/policy';
import { describe, it, expect } from 'vitest';

import {
  PUBLIC_PATHS,
  ROUTE_ACCESS,
  isPublic,
  roleMayReach,
  ruleFor,
} from '../../src/lib/route-access.js';

const ALL_ROLES = Role.options;
const SCHOOL = ['teacher', 'hod', 'smt', 'sbst', 'admin'];
const PLATFORM = ['platform_support', 'platform_admin'];

// Written out independently of the table on purpose: this is the policy as a reviewer
// would state it, so editing the table alone cannot quietly change who gets in.
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  '/teacher': ['teacher'],
  '/hod': ['hod'],
  '/smt': ['smt'],
  '/sbst': ['sbst'],
  '/guardian': ['guardian'],
  '/learner': ['learner'],
  '/approvals': SCHOOL,
  '/approvals/3a000000?runId=x': SCHOOL,
  '/admin/prompts': ['admin'],
  '/admin/setup': ['admin'],
  '/admin/curriculum/caps-canon': ['admin'],
  '/admin/env': ['admin', 'platform_admin'],
  '/platform/runs': PLATFORM,
  '/district': PLATFORM,
  '/api/approvals/abc/decide': SCHOOL,
  '/api/caps-canon': ['admin'],
  '/api/caps-canon/abc/ratify': ['admin'],
  '/api/caps-canon/abc/ingest': ['admin'],
};

describe('roleMayReach', () => {
  for (const [route, roles] of Object.entries(EXPECTED)) {
    const pathname = route.split('?')[0] ?? route;
    it(`${pathname} is for exactly: ${roles.join(', ')}`, () => {
      const may = ALL_ROLES.filter((r) => roleMayReach(r, pathname));
      expect([...may].sort()).toEqual([...roles].sort());
    });
  }

  it('lets every role reach / — the page that sends them to their own home', () => {
    for (const role of ALL_ROLES) expect(roleMayReach(role, '/')).toBe(true);
  });

  it('denies every role a route nobody listed', () => {
    for (const role of ALL_ROLES) {
      expect(roleMayReach(role, '/not-a-route')).toBe(false);
      expect(roleMayReach(role, '/admin')).toBe(false);
      expect(roleMayReach(role, '/api/new-handler')).toBe(false);
    }
  });

  // A path that merely resembles a listed one must match nothing, not the listed rule.
  it.each([
    '/HOD',
    '/Admin/prompts',
    '//hod',
    '/hodx',
    '/hod-secrets',
    '/approvalsx',
    '/%68od',
    '/hod%2F..%2Fadmin',
    '/admin/prompts%00',
    '/api/caps-canonx',
  ])('matches nothing for the lookalike %s', (pathname) => {
    expect(ruleFor(pathname)).toBeNull();
    for (const role of ALL_ROLES) expect(roleMayReach(role, pathname)).toBe(false);
  });

  it('matches a trailing slash and nested paths on a segment boundary', () => {
    expect(roleMayReach('hod', '/hod/')).toBe(true);
    expect(roleMayReach('hod', '/hod/anything/deeper')).toBe(true);
    expect(roleMayReach('teacher', '/hod/')).toBe(false);
  });

  it('grants no role anything on the public paths — they need no role', () => {
    for (const p of PUBLIC_PATHS) expect(ruleFor(p)).toBeNull();
  });
});

describe('isPublic', () => {
  it('is exactly the sign-in page, the auth routes and the liveness probe', () => {
    expect([...PUBLIC_PATHS].sort()).toEqual(['/api/auth', '/api/health', '/sign-in']);
    expect(isPublic('/sign-in')).toBe(true);
    expect(isPublic('/api/auth/session')).toBe(true);
    expect(isPublic('/api/health')).toBe(true);
  });

  it('does not widen to lookalikes or to the rest of /api', () => {
    for (const p of [
      '/api/healthz',
      '/api/health-secret',
      '/api',
      '/api/caps-canon',
      '/sign-in-x',
    ]) {
      expect(isPublic(p)).toBe(false);
    }
  });
});

// ---- the table cannot drift from the app --------------------------------------------

const appDir = fileURLToPath(new URL('../../src/app/', import.meta.url));

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === 'page.tsx' || entry.name === 'route.ts' ? [full] : [];
  });
}

/** `(shell)/approvals/[id]/page.tsx` → `/approvals/id`; `[...nextauth]` → `nextauth`. */
function urlFor(file: string): string {
  const segments = path
    .relative(appDir, path.dirname(file))
    .split(path.sep)
    .filter((s) => s !== '' && !(s.startsWith('(') && s.endsWith(')')))
    .map((s) => s.replace(/^\[(?:\.\.\.)?(.+)\]$/, '$1'));
  return `/${segments.join('/')}`;
}

describe('every page and handler in the app', () => {
  const files = routeFiles(appDir);

  it('finds the app (guards the walk itself)', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it.each(files.map((f) => [path.relative(appDir, f), f] as const))(
    '%s is public, the home page, or covered by a rule',
    (_name, file) => {
      const url = urlFor(file);
      expect(
        isPublic(url) || url === '/' || ruleFor(url) !== null,
        `${url} has no entry in ROUTE_ACCESS — until it does, no role can reach it`,
      ).toBe(true);
    },
  );

  // Each page checks its own role as well. Pin those checks to the table: the roles a
  // file names must be exactly the roles its rule lists. (Files that name none — the
  // approval detail page and decide handler defer to the loader / orchestrator — are
  // skipped.)
  it.each(files.map((f) => [path.relative(appDir, f), f] as const))(
    '%s names the same roles as its rule',
    (_name, file) => {
      const rule = ruleFor(urlFor(file));
      if (rule === null) return;
      const source = readFileSync(file, 'utf8');
      const named = ALL_ROLES.filter((r) => new RegExp(`'${r}'`).test(source));
      if (named.length === 0) return;
      expect([...named].sort()).toEqual([...rule.roles].sort());
    },
  );

  it('has no rule that no page or handler uses', () => {
    const urls = files.map(urlFor);
    for (const rule of ROUTE_ACCESS) {
      expect(
        urls.some((u) => u === rule.prefix || u.startsWith(`${rule.prefix}/`)),
        `${rule.prefix} matches nothing in the app`,
      ).toBe(true);
    }
  });
});
