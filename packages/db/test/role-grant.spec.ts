import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SENSITIVE_ROLES, defaultRoleGrantExpiry } from '../src/role-grant.js';

const migration = readFileSync(
  join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261111100000_oq033_role_grant_request',
    'migration.sql',
  ),
  'utf8',
);

describe('role grant requests: the roles that need a second administrator', () => {
  it('are exactly the roles the table accepts (db constant against the SQL CHECK)', () => {
    const match = /"roles" <@ ARRAY\[([^\]]+)\]::text\[\]/.exec(migration);
    if (match?.[1] === undefined) throw new Error('role list not found in the migration');
    const inSql = match[1].split(',').map((r) => r.trim().replace(/^'|'$/g, ''));
    expect([...inSql].sort()).toEqual([...SENSITIVE_ROLES].sort());
  });
});

describe('defaultRoleGrantExpiry', () => {
  it('is seven days after the given moment', () => {
    const now = new Date('2026-11-11T08:00:00.000Z');
    expect(defaultRoleGrantExpiry(now).toISOString()).toBe('2026-11-18T08:00:00.000Z');
  });
});
