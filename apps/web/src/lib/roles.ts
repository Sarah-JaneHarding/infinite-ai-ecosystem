import type { Role } from '@infinite-ai/policy';

/** The URL path prefix for each role's home surface. */
export const ROLE_HOME: Record<Role, string> = {
  teacher: '/teacher',
  hod: '/hod',
  smt: '/smt',
  sbst: '/sbst',
  admin: '/admin/prompts',
  guardian: '/guardian',
  learner: '/learner',
  platform_support: '/platform/runs',
  platform_admin: '/platform/runs',
};

/** Human-readable display label for each role. */
export const ROLE_LABEL: Record<Role, string> = {
  teacher: 'Teacher',
  hod: 'Head of Department',
  smt: 'School Management Team',
  sbst: 'School-Based Support Team',
  admin: 'Administrator',
  guardian: 'Guardian / Parent',
  learner: 'Learner',
  platform_support: 'Platform Support',
  platform_admin: 'Platform Administrator',
};

/** Colour hue associated with each role (used in ModularCard headers). */
export const ROLE_HUE: Record<Role, string> = {
  teacher: 'blue',
  hod: 'teal',
  smt: 'indigo',
  sbst: 'green',
  admin: 'violet',
  guardian: 'orange',
  learner: 'amber',
  platform_support: 'red',
  platform_admin: 'red',
};

/** Nav links visible to each role. */
export interface NavLink {
  readonly label: string;
  readonly href: string;
}

export const ROLE_NAV: Record<Role, readonly NavLink[]> = {
  teacher: [
    { label: 'Studio', href: '/teacher' },
    { label: 'Approvals', href: '/approvals' },
  ],
  hod: [
    { label: 'Console', href: '/hod' },
    { label: 'Approvals', href: '/approvals' },
    { label: 'Coverage', href: '/hod/coverage' },
  ],
  smt: [
    { label: 'Dashboard', href: '/smt' },
    { label: 'Tiers', href: '/smt/tiers' },
    { label: 'PD', href: '/smt/pd' },
  ],
  sbst: [
    { label: 'Casebook', href: '/sbst' },
    { label: 'Meetings', href: '/sbst/meetings' },
  ],
  admin: [{ label: 'Prompts', href: '/admin/prompts' }],
  guardian: [{ label: 'Portal', href: '/guardian' }],
  learner: [{ label: 'Space', href: '/learner' }],
  platform_support: [{ label: 'Run Inspector', href: '/platform/runs' }],
  platform_admin: [
    { label: 'Run Inspector', href: '/platform/runs' },
    { label: 'Tenants', href: '/platform/tenants' },
  ],
};

/** Returns true when a role is permitted to view the given pathname. */
export function roleCanViewPath(role: Role, pathname: string): boolean {
  const allowed = ROLE_NAV[role].map((l) => l.href);
  // A role can always access its home surface.
  allowed.push(ROLE_HOME[role]);
  // Approvals are shared across school roles.
  const schoolRoles: ReadonlyArray<string> = ['teacher', 'hod', 'smt', 'sbst', 'admin'];
  if (schoolRoles.includes(role)) allowed.push('/approvals');
  return allowed.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
