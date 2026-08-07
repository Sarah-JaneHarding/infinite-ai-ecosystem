// Stage 01 exit gate, the programmatic half:
//
//   "Every tenant-owned table appears in the RLS suite (assert this programmatically by
//    comparing the table list from information_schema against the tables covered by the
//    test — a table with no test is a failing test)."
//
// schema-classification.spec.ts does the equivalent check by reading the source, which is
// fast and runs anywhere. This one asks the live database what actually exists, and so
// catches the cases source-reading cannot: a migration that applied differently from how
// it reads, a policy dropped by a later migration, a table created outside Prisma.

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  NON_TENANT_TABLES,
  SELF_KEYED_TENANT_TABLES,
  TENANT_OWNED_TABLES,
} from '../src/tables.js';
import { startTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let migrator: PrismaClient;

beforeAll(async () => {
  db = await startTestDatabase();
  migrator = db.clientFor('migrator');
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

async function publicTables(): Promise<string[]> {
  const rows = await migrator.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  return rows.map((row) => row.table_name);
}

async function tablesWithTenantId(): Promise<string[]> {
  // Join with information_schema.tables to restrict to BASE TABLE — views that
  // expose tenant_id (e.g. analytics views) must not be classified as
  // tenant-owned tables: they have no RLS of their own and inherit it from
  // the underlying tables.
  const rows = await migrator.$queryRaw<{ table_name: string }[]>`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
  `;
  return rows.map((row) => row.table_name);
}

describe('every table in the database is accounted for', () => {
  it('classifies every base table', async () => {
    const known = new Set<string>([
      ...TENANT_OWNED_TABLES,
      ...SELF_KEYED_TENANT_TABLES,
      ...NON_TENANT_TABLES,
    ]);

    for (const table of await publicTables()) {
      expect(
        known,
        `${table} exists in the database but is not classified in src/tables.ts. ` +
          'A table with no classification has no isolation test, and a table with no ' +
          'test is a failing test.',
      ).toContain(table);
    }
  });

  it('finds every classified table actually present', async () => {
    const present = new Set(await publicTables());
    for (const table of [...TENANT_OWNED_TABLES, ...SELF_KEYED_TENANT_TABLES]) {
      expect(
        present,
        `${table} is classified but does not exist in the database`,
      ).toContain(table);
    }
  });

  it('treats every table carrying tenant_id as tenant-owned', async () => {
    // The inverse direction: a table that grew a tenant_id column without being added to
    // TENANT_OWNED_TABLES would otherwise slip past the isolation cases entirely.
    const owned = new Set<string>(TENANT_OWNED_TABLES);
    for (const table of await tablesWithTenantId()) {
      expect(
        owned,
        `${table} has a tenant_id column but is not in TENANT_OWNED_TABLES`,
      ).toContain(table);
    }
  });
});

describe('row level security is live on every isolated table', () => {
  const isolated = [...TENANT_OWNED_TABLES, ...SELF_KEYED_TENANT_TABLES];

  it.each(isolated)('%s has RLS enabled and forced', async (table) => {
    const rows = await migrator.$queryRaw<
      { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE relname = ${table} AND relnamespace = 'public'::regnamespace
    `;
    expect(rows, `${table} not found in pg_class`).toHaveLength(1);
    expect(rows[0]!.relrowsecurity, `${table} does not have RLS enabled`).toBe(true);
    expect(
      rows[0]!.relforcerowsecurity,
      `${table} does not FORCE RLS, so its owner bypasses isolation`,
    ).toBe(true);
  });

  it.each(isolated)(
    '%s has an isolation policy for both USING and WITH CHECK',
    async (table) => {
      const rows = await migrator.$queryRaw<
        { qual: string | null; with_check: string | null }[]
      >`
      SELECT qual, with_check FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ${table} AND policyname = 'tenant_isolation'
    `;
      expect(rows, `${table} has no tenant_isolation policy`).toHaveLength(1);

      // A policy with a USING clause but no WITH CHECK would block reads while permitting a
      // write that plants a row in another tenant.
      expect(rows[0]!.qual, `${table} policy has no USING clause`).toBeTruthy();
      expect(
        rows[0]!.with_check,
        `${table} policy has no WITH CHECK clause`,
      ).toBeTruthy();
    },
  );

  it.each(isolated)(
    '%s policy uses the raising form of current_setting',
    async (table) => {
      const rows = await migrator.$queryRaw<{ qual: string }[]>`
      SELECT qual FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ${table} AND policyname = 'tenant_isolation'
    `;
      // Postgres renders the two-argument form with its literal second argument. `true`
      // there would mean a missing setting yields NULL, turning a context-less query into a
      // silent empty result rather than the loud failure the exit gate requires.
      expect(rows[0]!.qual).toContain('false');
    },
  );
});
