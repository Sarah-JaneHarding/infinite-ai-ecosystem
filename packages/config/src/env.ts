// The single, Zod-validated environment loader for the whole monorepo.
//
// Rule 7 (Part 0 §0.2): no secret ever lives in the repository, and no other package
// may read `process.env`. An ESLint rule enforces the second half of that; this file
// is the sanctioned exception.
//
// The application crashes at boot on a missing or malformed variable (Stage 00 step 4).
// It does not fall back to a default that quietly disables a control.

import { z } from 'zod';

/**
 * Deployment environments. `test` exists so Testcontainers-backed suites can boot the
 * real loader rather than a mock of it.
 */
export const NodeEnv = z.enum(['development', 'test', 'production']);
export type NodeEnv = z.infer<typeof NodeEnv>;

/**
 * Data residency. Learner data lives in `af-south-1` at rest (§1.3). The value is
 * validated rather than assumed so a misconfigured deployment fails loudly.
 */
export const Region = z.enum(['af-south-1', 'local']);
export type Region = z.infer<typeof Region>;

const nonEmpty = (label: string) =>
  z.string().trim().min(1, `${label} must not be empty`);

const postgresUrl = z
  .string()
  .url('DATABASE_URL must be a URL')
  .refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'DATABASE_URL must be a PostgreSQL connection string',
  );

const redisUrl = z
  .string()
  .url('REDIS_URL must be a URL')
  .refine(
    (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
    'REDIS_URL must be a Redis connection string',
  );

/**
 * The environment contract.
 *
 * Every variable declared here must also appear, by name and with an empty value, in
 * `.env.example`. A test asserts the two stay in step, so adding a variable without
 * documenting it fails CI.
 */
export const EnvSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  APP_REGION: Region.default('local'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Data plane — Stage 01.
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,

  // Identity — Stage 02.
  KEYCLOAK_ISSUER_URL: z.string().url().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),

  // Model gateway — Stage 04. Application code talks to the gateway, never a provider.
  GATEWAY_BASE_URL: z.string().url().default('http://localhost:8080'),

  // Object storage — MinIO in dev, S3 af-south-1 in prod.
  OBJECT_STORE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORE_BUCKET: nonEmpty('OBJECT_STORE_BUCKET').optional(),

  // Observability — Stage 15.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Thrown when the environment does not satisfy the contract. Never caught to continue. */
export class EnvironmentValidationError extends Error {
  public override readonly name = 'EnvironmentValidationError';

  constructor(public readonly issues: readonly z.ZodIssue[]) {
    const detail = issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    super(
      `Invalid environment. The application will not start.\n${detail}\n\n` +
        'See .env.example for the full list of required variable names.',
    );
  }
}

/**
 * Parses an arbitrary record against the contract.
 *
 * Exported separately from {@link loadEnv} so tests can exercise failure paths without
 * mutating the real process environment.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvironmentValidationError(result.error.issues);
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Loads and caches the validated environment.
 *
 * Call this once at boot. Everything downstream imports the resulting object rather
 * than reaching for `process.env` itself.
 */
export function loadEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test-only: drops the cache so a suite can load a different environment. */
export function resetEnvCacheForTesting(): void {
  cached = undefined;
}
