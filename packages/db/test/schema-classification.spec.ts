// Every table in the Prisma schema is classified, and every tenant-owned table has an
// RLS policy in the migration — checked by reading the source files rather than a
// database, so it runs everywhere, including where Docker is unavailable.
//
// The live proof against real Postgres is rls.spec.ts. This is the cheap check that
// catches the common mistake — adding a model and forgetting its policy — in seconds,
// on every machine, instead of minutes later in CI.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  NON_TENANT_TABLES,
  SELF_KEYED_TENANT_TABLES,
  TENANT_OWNED_TABLES,
} from '../src/tables.js';

const schemaPath = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));
const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

const schema = readFileSync(schemaPath, 'utf8');

/**
 * Table names as mapped into Postgres, i.e. what information_schema will report.
 *
 * Scoped to `model` blocks on purpose: enums carry `@@map` too, and treating an enum's
 * mapped name as a table would demand an RLS policy on something that has no rows.
 */
const modelBlocks = [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map(
  (m) => m[1]!,
);

const mappedTables = modelBlocks.flatMap((body) => {
  const match = /@@map\("([a-z_]+)"\)/.exec(body);
  return match ? [match[1]!] : [];
});

const migrationSql = readdirSync(migrationsDir)
  .flatMap((dir) => {
    try {
      return [readFileSync(`${migrationsDir}/${dir}/migration.sql`, 'utf8')];
    } catch {
      return [];
    }
  })
  .join('\n');

/** Migration SQL with `--` comments removed, for assertions about what actually runs. */
const executableSql = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('schema classification', () => {
  it('classifies every table the schema defines', () => {
    const classified = new Set<string>([
      ...TENANT_OWNED_TABLES,
      ...SELF_KEYED_TENANT_TABLES,
      ...NON_TENANT_TABLES,
    ]);

    for (const table of mappedTables) {
      expect(
        classified,
        `${table} is in the schema but not classified in src/tables.ts`,
      ).toContain(table);
    }
  });

  it('classifies no table the schema does not define', () => {
    const defined = new Set(mappedTables);
    for (const table of [...TENANT_OWNED_TABLES, ...SELF_KEYED_TENANT_TABLES]) {
      expect(defined, `${table} is classified but not in the schema`).toContain(table);
    }
  });

  it.each(TENANT_OWNED_TABLES)('gives %s a tenant_id column', (table) => {
    const body = modelBlocks.find((block) => block.includes(`@@map("${table}")`));
    expect(body, `no model maps to ${table}`).toBeDefined();
    expect(body, `${table} has no tenant_id column`).toContain('@map("tenant_id")');
  });

  it('gives the self-keyed tenant table no tenant_id column', () => {
    // If `tenant` ever grows a tenant_id, its policy is wrong and the special case in
    // src/tables.ts has stopped describing reality.
    const body = modelBlocks.find((block) => block.includes('@@map("tenant")'));
    expect(body).toBeDefined();
    expect(body).not.toContain('@map("tenant_id")');
  });
});

describe('RLS policies in the migration', () => {
  const allIsolated = [...TENANT_OWNED_TABLES, ...SELF_KEYED_TENANT_TABLES];

  it.each(allIsolated)('enables row level security on %s', (table) => {
    expect(migrationSql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  });

  it.each(allIsolated)(
    'forces row level security on %s, binding the owner too',
    (table) => {
      expect(migrationSql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    },
  );

  it.each(allIsolated)('creates an isolation policy on %s', (table) => {
    expect(migrationSql).toContain(`CREATE POLICY tenant_isolation ON "${table}"`);
  });

  it('uses the raising form of current_setting everywhere', () => {
    // current_setting('app.tenant_id', true) returns NULL when unset, which would make a
    // context-less query quietly match nothing instead of failing. The exit gate requires
    // it to fail loudly, so the missing_ok argument must be false at every occurrence.
    //
    // Comments are stripped first, on the same reasoning as the CREATE SCHEMA check below.
    // The Stage 03 migration names the non-raising form in prose, in a list of approaches
    // it considered and rejected — and a check that trips over a written warning against
    // the very thing it guards is a check that gets deleted rather than heeded. What runs
    // is what can weaken a policy, and this now inspects exactly that.
    const occurrences = [
      ...executableSql.matchAll(/current_setting\('app\.tenant_id'[^)]*\)/g),
    ];
    // Guards the check against passing vacuously if the policies were ever removed.
    expect(occurrences.length).toBeGreaterThan(0);
    for (const [occurrence] of occurrences) {
      expect(occurrence, 'must use the raising form').toContain('false');
    }
  });

  it('creates no schema, so migrator needs no database-level CREATE', () => {
    // Prisma emits `CREATE SCHEMA IF NOT EXISTS "public"` when regenerating a migration
    // from an empty baseline. That statement needs CREATE on the database, which the
    // migrator role deliberately lacks (§1.3), and Postgres checks the privilege before
    // the IF NOT EXISTS short-circuit — so it fails even though `public` already exists.
    // It cost a red CI run once; this stops it costing another.
    //
    // Comments are stripped first: the migration explains in prose why the statement was
    // removed, and a check that trips over its own explanation is worse than no check.
    expect(executableSql).not.toMatch(/CREATE\s+SCHEMA/i);
  });

  it('keeps the audit ledger append-only at the database level', () => {
    expect(migrationSql).toContain('CREATE TRIGGER audit_event_append_only');
    expect(migrationSql).toMatch(/BEFORE UPDATE OR DELETE ON "audit_event"/);
  });
});
