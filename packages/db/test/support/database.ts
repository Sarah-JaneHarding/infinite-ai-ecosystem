// Test database harness — a real Postgres 16 with pgvector, the real initdb scripts, and
// the real migrations.
//
// Two things here are load-bearing and easy to get wrong.
//
// 1. The isolation assertions must run as `app_rw`, NOT as the container's superuser.
//    Testcontainers hands back a superuser connection, and a superuser bypasses RLS
//    entirely. A suite written against it would pass while proving nothing at all — the
//    single most dangerous failure mode available to this stage.
//
// 2. The container mounts `infra/docker/initdb/`, the same scripts a developer's compose
//    stack and production bootstrap run. A test-only copy of the role definitions could
//    drift from the real ones, and then the suite would be proving isolation for a role
//    configuration nobody actually deploys.
//
// There is deliberately no "skip if Docker is unavailable" path. Rule 2: a silently
// skipped isolation suite is indistinguishable from a passing one, so absence of Docker
// must fail loudly.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PrismaClient, type Prisma } from '@prisma/client';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const initdbDir = fileURLToPath(
  new URL('../../../../infra/docker/initdb', import.meta.url),
);
const packageDir = fileURLToPath(new URL('../..', import.meta.url));

/** Passwords for the test container only. Generated per run; never written anywhere. */
const PASSWORDS = {
  migrator: randomSecret(),
  app_rw: randomSecret(),
  worker_rw: randomSecret(),
  analytics_ro: randomSecret(),
} as const;

function randomSecret(): string {
  // Not cryptographic key material — just an unguessable value for an ephemeral container
  // that exists for the duration of one test run.
  return `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type DatabaseRole = keyof typeof PASSWORDS;

export interface TestDatabase {
  readonly container: StartedPostgreSqlContainer;
  /** Connection URL for a given role. */
  urlFor(role: DatabaseRole): string;
  /** A Prisma client connected as `role`. Remember to disconnect it. */
  clientFor(role: DatabaseRole): PrismaClient;
  stop(): Promise<void>;
}

/**
 * Starts Postgres, runs the real initdb scripts, and applies the migrations as `migrator`.
 *
 * Slow — a container start plus a migration run — so suites share one instance via a
 * module-level `beforeAll` rather than starting one per test.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('infinite_ai_test')
    .withUsername('postgres')
    .withPassword(randomSecret())
    .withEnvironment({
      MIGRATOR_PASSWORD: PASSWORDS.migrator,
      APP_RW_PASSWORD: PASSWORDS.app_rw,
      WORKER_RW_PASSWORD: PASSWORDS.worker_rw,
      ANALYTICS_RO_PASSWORD: PASSWORDS.analytics_ro,
    })
    // The real extension and role scripts, not a copy.
    .withBindMounts([
      { source: initdbDir, target: '/docker-entrypoint-initdb.d', mode: 'ro' },
    ])
    .start();

  const urlFor = (role: DatabaseRole): string =>
    `postgresql://${role}:${PASSWORDS[role]}@${container.getHost()}:${container.getMappedPort(
      5432,
    )}/${container.getDatabase()}`;

  // Migrations run as migrator: the only role permitted to DDL (step 2).
  execFileSync('node', ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: packageDir,
    env: { ...process.env, DATABASE_URL: urlFor('migrator') },
    stdio: 'pipe',
  });

  const clients: PrismaClient[] = [];

  return {
    container,
    urlFor,
    clientFor(role) {
      const client = new PrismaClient({ datasources: { db: { url: urlFor(role) } } });
      clients.push(client);
      return client;
    },
    async stop() {
      await Promise.all(clients.map((client) => client.$disconnect()));
      await container.stop();
    },
  };
}

/**
 * Runs `fn` with the tenant context set, against an arbitrary client.
 *
 * Mirrors what `withTenant` in src/client.ts does, but takes the client as an argument so
 * a test can drive the same code path as a *different role*. The production helper always
 * uses the application's own pooled client, which is right for production and useless for
 * proving that isolation binds `migrator` too.
 */
export async function asTenant<T>(
  client: PrismaClient,
  tenantId: string,
  actorId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId}, true)`;
    return fn(tx);
  });
}
