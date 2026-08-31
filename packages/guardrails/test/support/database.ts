// Test database harness for `brain-age-appropriateness.integration.spec.ts` — a real
// Postgres via Testcontainers, the same initdb scripts and migrations @infinite-ai/db's
// own harness uses, and the same shape @infinite-ai/brain's, @infinite-ai/orchestrator's
// and @infinite-ai/curriculum-seed's own copies of this file already establish — this
// suite never needs to act as `migrator` or bypass RLS, only ever through `withTenant()`,
// so a single `app_rw` connection string is all this exposes.
//
// No skip path if Docker is unavailable, for the same reason every other integration
// harness in this project has none (rule 2).

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
  return `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface TestDatabase {
  readonly appRwUrl: string;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('infinite_ai_guardrails_test')
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
