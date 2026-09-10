// The gateway's own environment loader — Stage 04.
//
// `packages/config` is the sanctioned place to read `process.env` for the rest of the
// monorepo (rule 7), but provider credentials belong nowhere near that shared schema:
// `.env.example`'s Stage 04 section already says why — "Provider credentials are
// configured on the gateway itself and never appear in any other service's environment."
// A key that every service's environment carries is a key every service can leak. So this
// is a second, narrower loader, scoped to `apps/gateway`, with its own example file
// (`apps/gateway/.env.example`) and its own crash-at-boot discipline — the same pattern
// as `packages/config`, deliberately not merged into it.

import { z } from 'zod';

const commaSeparatedKeys = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0),
  )
  .refine((keys) => keys.length > 0, 'must contain at least one non-empty key');

export const GatewayEnvSchema = z.object({
  GATEWAY_PORT: z.coerce.number().int().positive().default(8080),

  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  ANTHROPIC_API_KEYS: commaSeparatedKeys.optional(),

  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_API_KEYS: commaSeparatedKeys.optional(),

  /** A self-hosted, OpenAI-compatible inference server (vLLM, Ollama, TGI). */
  LOCAL_MODEL_BASE_URL: z.string().url().optional(),
  LOCAL_MODEL_API_KEYS: commaSeparatedKeys.optional(),

  /** Path to the routing JSON (step 4). Falls back to `DEFAULT_ROUTING_CONFIG` if unset. */
  ROUTING_CONFIG_PATH: z.string().optional(),
});
export type GatewayEnv = z.infer<typeof GatewayEnvSchema>;

export class GatewayEnvironmentValidationError extends Error {
  public override readonly name = 'GatewayEnvironmentValidationError';

  constructor(public readonly issues: readonly z.ZodIssue[]) {
    const detail = issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    super(
      `Invalid gateway environment. The gateway will not start.\n${detail}\n\n` +
        'See apps/gateway/.env.example for the full list of variable names.',
    );
  }
}

export function parseGatewayEnv(source: Record<string, string | undefined>): GatewayEnv {
  const result = GatewayEnvSchema.safeParse(source);
  if (!result.success) {
    throw new GatewayEnvironmentValidationError(result.error.issues);
  }
  return result.data;
}

let cached: GatewayEnv | undefined;

export function loadGatewayEnv(): GatewayEnv {
  cached ??= parseGatewayEnv(process.env);
  return cached;
}

/** Test-only: drops the cache so a suite can load a different environment. */
export function resetGatewayEnvCacheForTesting(): void {
  cached = undefined;
}
