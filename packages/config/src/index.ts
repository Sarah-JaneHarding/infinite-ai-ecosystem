// @infinite-ai/config — the one place environment variables are read and validated.

export {
  EnvSchema,
  EnvironmentValidationError,
  NodeEnv,
  Region,
  loadEnv,
  parseEnv,
  resetEnvCacheForTesting,
  type Env,
} from './env.js';

export const PACKAGE_NAME = '@infinite-ai/config' as const;
