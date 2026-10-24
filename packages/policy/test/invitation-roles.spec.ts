import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLATFORM_ROLES, Role } from '../src/rbac.js';

// OQ-033 drift guard. The invitation table's CHECK constraint lists the roles an invitation may
// carry — school staff only. That list lives in SQL, so nothing in the type system ties it to
// the `Role` enum. If a role is added or renamed here, or a platform role were ever added to
// the SQL list, this fails first.
const migration = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    'db',
    'prisma',
    'migrations',
    '20261024090000_oq033_user_invitation',
    'migration.sql',
  ),
  'utf8',
);

function invitableRolesInSql(): string[] {
  const match = /"roles" <@ ARRAY\[([^\]]+)\]::text\[\]/.exec(migration);
  if (match?.[1] === undefined) throw new Error('role list not found in the migration');
  return match[1].split(',').map((r) => r.trim().replace(/^'|'$/g, ''));
}

describe('roles an invitation may carry (user_invitation CHECK constraint)', () => {
  it('are all real roles', () => {
    for (const role of invitableRolesInSql()) {
      expect(Role.safeParse(role).success, `${role} is not a Role`).toBe(true);
    }
  });

  it('include no platform role', () => {
    for (const role of invitableRolesInSql()) {
      expect(PLATFORM_ROLES as readonly string[]).not.toContain(role);
    }
  });

  it('are exactly the school staff roles — every role except platform, guardian and learner', () => {
    const expected = Role.options.filter(
      (r) =>
        !(PLATFORM_ROLES as readonly string[]).includes(r) &&
        r !== 'guardian' &&
        r !== 'learner',
    );
    expect([...invitableRolesInSql()].sort()).toEqual([...expected].sort());
  });
});
