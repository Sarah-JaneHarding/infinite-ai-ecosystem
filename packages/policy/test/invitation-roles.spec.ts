import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONFIRMATION_REQUIRED_ROLES, SCHOOL_STAFF_ROLES } from '../src/provisioning.js';
import { PLATFORM_ROLES, Role } from '../src/rbac.js';

// OQ-033 drift guard. The invitation table's CHECK constraint lists the roles an invitation may
// carry — school staff only. That list lives in SQL, so nothing in the type system ties it to
// the `Role` enum. If a role is added or renamed here, or a platform role were ever added to
// the SQL list, this fails first.
const migrationsDir = join(__dirname, '..', '..', 'db', 'prisma', 'migrations');
const migration = readFileSync(
  join(migrationsDir, '20261024090000_oq033_user_invitation', 'migration.sql'),
  'utf8',
);
// The constraint was re-stated (with an explicit IS NOT NULL) in a later migration; the list in it
// must stay the same list, or the table's real constraint would drift from the one tested here.
const restated = readFileSync(
  join(
    migrationsDir,
    '20261111110000_oq033_user_invitation_roles_not_null',
    'migration.sql',
  ),
  'utf8',
);

function rolesIn(sql: string): string[] {
  // Comments first: a migration's header may quote the constraint it is explaining.
  const code = sql.replace(/--.*$/gm, '');
  const match = /"roles" <@ ARRAY\[([^\]]+)\]::text\[\]/.exec(code);
  if (match?.[1] === undefined) throw new Error('role list not found in the migration');
  return match[1].split(',').map((r) => r.trim().replace(/^'|'$/g, ''));
}

function invitableRolesInSql(): string[] {
  return rolesIn(migration);
}

describe('roles an invitation may carry (user_invitation CHECK constraint)', () => {
  it('are the same list in the migration that added the IS NOT NULL test', () => {
    expect(rolesIn(restated)).toEqual(rolesIn(migration));
    expect(restated.replace(/--.*$/gm, '')).toContain('"roles" IS NOT NULL');
  });

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

  it('are exactly the roles the policy package lets an administrator confer', () => {
    // SCHOOL_STAFF_ROLES gates the application's guard-rails; the CHECK constraint gates the
    // data. If one changes without the other, a role could be refused by the app but accepted
    // by the table (harmless) or — worse — accepted by the app and refused only at commit.
    expect([...invitableRolesInSql()].sort()).toEqual([...SCHOOL_STAFF_ROLES].sort());
  });
});

// OQ-033 step 3b drift guard. The role grant request table accepts only the roles that need a
// second administrator; that list is SQL, so nothing ties it to policy's rule. If the rule gains
// or loses a role, or the SQL list changes alone, this fails first.
describe('roles a role grant request may carry (role_grant_request CHECK constraint)', () => {
  const grantMigration = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'db',
      'prisma',
      'migrations',
      '20261111100000_oq033_role_grant_request',
      'migration.sql',
    ),
    'utf8',
  );

  it('are exactly the roles that need a second administrator', () => {
    const match = /"roles" <@ ARRAY\[([^\]]+)\]::text\[\]/.exec(grantMigration);
    if (match?.[1] === undefined) throw new Error('role list not found in the migration');
    const inSql = match[1].split(',').map((r) => r.trim().replace(/^'|'$/g, ''));
    expect([...inSql].sort()).toEqual([...CONFIRMATION_REQUIRED_ROLES].sort());
  });
});
