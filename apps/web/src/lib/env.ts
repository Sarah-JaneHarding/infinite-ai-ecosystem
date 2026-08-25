// Web-specific environment loader — the one place process.env is read in apps/web.
// Mirrors the pattern in apps/gateway/src/config.
import { z } from 'zod';

export const WebEnvSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  AUTH_KEYCLOAK_ID: z.string().default(''),
  AUTH_KEYCLOAK_SECRET: z.string().default(''),
  AUTH_KEYCLOAK_ISSUER: z
    .string()
    .url()
    .optional()
    .default('http://localhost:8080/realms/infinite-ai'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

const BUILD_TIME_ENV: WebEnv = {
  NEXTAUTH_URL: undefined,
  NEXTAUTH_SECRET: 'build-time-placeholder-secret-not-used-in-production',
  AUTH_KEYCLOAK_ID: 'build-time',
  AUTH_KEYCLOAK_SECRET: 'build-time',
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/infinite-ai',
  NODE_ENV: 'production',
};

const TEST_ENV: WebEnv = {
  NEXTAUTH_URL: undefined,
  NEXTAUTH_SECRET: 'test-secret-for-unit-tests-minimum-32-chars-ok',
  AUTH_KEYCLOAK_ID: 'test-client',
  AUTH_KEYCLOAK_SECRET: 'test-secret',
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/infinite-ai',
  NODE_ENV: 'test',
};

let _env: WebEnv | undefined;

export function getWebEnv(): WebEnv {
  if (_env) return _env;
  // During Next.js build, secrets are not present — return a placeholder so the
  // build succeeds. Real validation happens at request time in production.
  if (process.env['NEXT_PHASE'] === 'phase-production-build') {
    return BUILD_TIME_ENV;
  }
  if (process.env['NODE_ENV'] === 'test') {
    _env = { ...TEST_ENV };
    return _env;
  }
  const parsed = WebEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Web environment invalid: ${parsed.error.message}`);
  }
  _env = parsed.data;
  return _env;
}

export function resetEnvCacheForTesting(): void {
  _env = undefined;
}
