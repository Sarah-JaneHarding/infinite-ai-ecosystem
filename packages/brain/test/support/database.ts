// Test database harness for the write-path integration suite — Stage 05 step 2.
//
// A real Postgres via Testcontainers, the same initdb scripts and migrations
// @infinite-ai/db's own harness uses, so the roles and RLS policies this suite runs
// against are the ones actually deployed, not a test-only approximation of them.
//
// Unlike @infinite-ai/db's harness, this one exposes a single connection string — for
// `app_rw`, the role the write path actually runs as in production — rather than a client
// per role. The write path never needs to act as `migrator` or bypass RLS; it only ever
// goes through `withTenant()`, the same as any other caller of @infinite-ai/db. Migrations
// still run as `migrator`, via the Prisma CLI directly, because that is the one operation
// that needs DDL privileges this suite has no other use for.
//
// No skip path if Docker is unavailable, for the same reason @infinite-ai/db's harness has
// none (rule 2): a silently skipped resumability suite is indistinguishable from a
// passing one.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer } from '@testcontainers/postgresql';

const initdbDir = fileURLToPath(
  new URL('../../../../infra/docker/initdb', import.meta.url),
);
const dbPackageDir = fileURLToPath(new URL('../../../db', import.meta.url));

const PASSWORDS = {
  migrator: randomSecret(),
  app_rw: randomSecret(),
  worker_rw: randomSecret(),
  analytics_ro: randomSecret(),
} as const;

function randomSecret(): string {
  // Not cryptographic key material — an unguessable value for an ephemeral container that
  // exists for the duration of one test run. Same reasoning as @infinite-ai/db's harness.
  return `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface TestDatabase {
  /** Connection string for `app_rw` — what `DATABASE_URL` is set to for this run. */
  readonly appRwUrl: string;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('infinite_ai_brain_test')
    .withUsername('postgres')
    .withPassword(randomSecret())
    .withEnvironment({
      MIGRATOR_PASSWORD: PASSWORDS.migrator,
      APP_RW_PASSWORD: PASSWORDS.app_rw,
      WORKER_RW_PASSWORD: PASSWORDS.worker_rw,
      ANALYTICS_RO_PASSWORD: PASSWORDS.analytics_ro,
    })
    .withBindMounts([
      { source: initdbDir, target: '/docker-entrypoint-initdb.d', mode: 'ro' },
    ])
    .start();

  const urlFor = (role: keyof typeof PASSWORDS): string =>
    `postgresql://${role}:${PASSWORDS[role]}@${container.getHost()}:${container.getMappedPort(
      5432,
    )}/${container.getDatabase()}`;

  // Migrations run as migrator: the only role permitted to DDL, exactly as in production.
  execFileSync('node', ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: urlFor('migrator') },
    stdio: 'pipe',
  });

  return {
    appRwUrl: urlFor('app_rw'),
    async stop() {
      await container.stop();
    },
  };
}
