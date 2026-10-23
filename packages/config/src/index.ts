// @infinite-ai/config — the one place environment variables are read and validated.

export {
  EnvSchema,
  EnvironmentValidationError,
  NodeEnv,
  Region,
  loadDatabaseUrl,
  loadEnv,
  parseEnv,
  resetEnvCacheForTesting,
  type Env,
} from './env.js';

export {
  FeatureFlagSchema,
  FLAGS,
  expiredFlags,
  isEnabled,
  type FeatureFlag,
  type FlagKey,
} from './flags.js';

export const PACKAGE_NAME = '@infinite-ai/config' as const;
