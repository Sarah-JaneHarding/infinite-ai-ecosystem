// Which roles may reach which routes — one table, enforced in `proxy.ts` before a page or
// route handler runs. Policy is data: read it top to bottom.
//
// Every page and handler still checks its own role (defence in depth), and a test pins each
// of those checks to this table so the two cannot drift. What this adds is a single place a
// reviewer can see who can reach what, and a default that fails closed: a route that is not
// listed here is reachable by nobody until someone decides who may see it.
//
// `roleCanViewPath` in `roles.ts` is NOT this table. It is derived from the navigation (a
// role's own links) and cannot express a page that is not linked (`/district`) or a role
// that may open a page it has no link to (`/admin/curriculum/caps-canon`).

import type { Role } from '@infinite-ai/policy';

import { readRole, readRoles } from './session-role';

/** Routes anyone may reach without a session. `/api/health` is the container liveness probe. */
export const PUBLIC_PATHS: readonly string[] = ['/sign-in', '/api/auth', '/api/health'];

const SCHOOL_ROLES_WITH_A_QUEUE: readonly Role[] = [
  'teacher',
  'hod',
  'smt',
  'sbst',
  'sbst_chair',
  'admin',
];
const PLATFORM: readonly Role[] = ['platform_support', 'platform_admin'];

export interface RouteRule {
  /** Matches the path itself and everything beneath it, on a segment boundary. */
  readonly prefix: string;
  readonly roles: readonly Role[];
}

export const ROUTE_ACCESS: readonly RouteRule[] = [
  { prefix: '/teacher', roles: ['teacher'] },
  { prefix: '/hod', roles: ['hod'] },
  { prefix: '/smt', roles: ['smt'] },
  { prefix: '/sbst', roles: ['sbst', 'sbst_chair'] },
  { prefix: '/guardian', roles: ['guardian'] },
  { prefix: '/learner', roles: ['learner'] },
  { prefix: '/approvals', roles: SCHOOL_ROLES_WITH_A_QUEUE },
  { prefix: '/admin/prompts', roles: ['admin'] },
  { prefix: '/admin/setup', roles: ['admin'] },
  { prefix: '/admin/staff', roles: ['admin'] },
  { prefix: '/admin/curriculum/caps-canon', roles: ['admin'] },
  { prefix: '/admin/env', roles: ['admin', 'platform_admin'] },
  { prefix: '/platform/runs', roles: PLATFORM },
  { prefix: '/district', roles: PLATFORM },
  { prefix: '/api/approvals', roles: SCHOOL_ROLES_WITH_A_QUEUE },
  { prefix: '/api/caps-canon', roles: ['admin'] },
];

/** `/` is every signed-in role's way home: the page redirects to the role's own surface. */
const HOME = '/';

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => under(pathname, p));
}

/** The rule covering `pathname`, or `null`. Matching is exact and case-sensitive on purpose:
 * a path that merely resembles a listed one (`/HOD`, `//hod`, `/hodx`, `/%68od`) matches
 * nothing and so reaches nobody. */
export function ruleFor(pathname: string): RouteRule | null {
  return ROUTE_ACCESS.find((r) => under(pathname, r.prefix)) ?? null;
}

/** May `role` reach `pathname`? Anything unlisted is `false`, for every role. */
export function roleMayReach(role: Role, pathname: string): boolean {
  if (pathname === HOME) return true;
  const rule = ruleFor(pathname);
  return rule !== null && rule.roles.includes(role);
}

export function isApiPath(pathname: string): boolean {
  return under(pathname, '/api');
}

/** The one page a session with no active role may reach: where a person eligible for more than one
 * role picks the one to act as (OQ-032, §4.8). Not in `ROUTE_ACCESS`: no role may reach it, so a
 * session that already has a role is sent home by the default deny. */
export const CHOOSE_ROLE_PATH = '/choose-role';

export type AccessDecision =
  | { readonly kind: 'allow' }
  /** No session at all, or a token that is neither a role nor a pending choice. */
  | { readonly kind: 'sign-in' }
  /** Signed in but has not chosen a role: everything except the chooser is out of reach. */
  | { readonly kind: 'choose-role' }
  /** A role that may not reach this page. */
  | { readonly kind: 'deny' };

/**
 * What the proxy does with a request for a non-public `pathname`. `token` is the decoded session
 * token or `null`. Three states, and nothing is inferred between them:
 *  - an active role → the route table decides;
 *  - no active role but a valid list of roles to choose from → only `/choose-role`;
 *  - anything else → not a session.
 */
export function decideAccess(
  token: Readonly<Record<string, unknown>> | null,
  pathname: string,
): AccessDecision {
  if (token === null) return { kind: 'sign-in' };
  const role = readRole(token['role']);
  if (role !== null) {
    return roleMayReach(role, pathname) ? { kind: 'allow' } : { kind: 'deny' };
  }
  if (readRoles(token['eligibleRoles']) === null) return { kind: 'sign-in' };
  return pathname === CHOOSE_ROLE_PATH ? { kind: 'allow' } : { kind: 'choose-role' };
}
