import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// PROVISIONING_DESIGN §12.2 (decision 6). Accounts, role assignments, invitations and grant requests
// are written by the functions in this package, which take the tenant's provisioning lock so two
// administrators cannot both pass a check against one snapshot, audit in the same transaction, and
// refuse by the rules. Any other code holding a tenant context could write the same tables and
// skip all of that. The database cannot tell the difference (app_rw may write every table), so this
// does: no source file outside this package may write them.
const ROOT = join(__dirname, '..', '..', '..');
const TABLES = ['roleAssignment', 'userAccount', 'userInvitation', 'roleGrantRequest'];
const SQL_TABLES = [
  'role_assignment',
  'user_account',
  'user_invitation',
  'role_grant_request',
];
const WRITE_METHODS =
  'create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany';

const PRISMA_WRITE = new RegExp(`\\.(${TABLES.join('|')})\\.(${WRITE_METHODS})\\b`);
const SQL_WRITE = new RegExp(
  `\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+"?(${SQL_TABLES.join('|')})"?\\b`,
  'i',
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next' || name === 'dist') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}

/** Every `src` tree in the workspace except this package's own. */
function outsideSources(): string[] {
  const roots: string[] = [];
  for (const group of ['apps', 'packages']) {
    for (const name of readdirSync(join(ROOT, group))) {
      if (group === 'packages' && name === 'db') continue;
      const src = join(ROOT, group, name, 'src');
      try {
        if (statSync(src).isDirectory()) roots.push(src);
      } catch {
        // a workspace with no src directory has nothing to scan
      }
    }
  }
  return roots.flatMap(sourceFiles);
}

describe('only @infinite-ai/db writes the account, role, invitation and grant-request tables', () => {
  const files = outsideSources();

  it('scans the rest of the workspace', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.includes(join('apps', 'web', 'src')))).toBe(true);
  });

  it('finds no write through the Prisma client', () => {
    const offenders = files
      .filter((f) => PRISMA_WRITE.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('finds no write through raw SQL', () => {
    const offenders = files
      .filter((f) => SQL_WRITE.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it('the patterns do recognise a write (so a clean scan means something)', () => {
    expect(PRISMA_WRITE.test('await tx.roleAssignment.create({ data })')).toBe(true);
    expect(PRISMA_WRITE.test('await tx.userAccount.updateMany({})')).toBe(true);
    expect(PRISMA_WRITE.test('await tx.userAccount.findFirst({})')).toBe(false);
    expect(SQL_WRITE.test('INSERT INTO "role_assignment" (id)')).toBe(true);
    expect(SQL_WRITE.test('delete from user_invitation where')).toBe(true);
    expect(SQL_WRITE.test('SELECT * FROM user_account')).toBe(false);
  });
});
