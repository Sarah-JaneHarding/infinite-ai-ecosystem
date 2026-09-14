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

  // --- Anthropic Claude ----------------------------------------------------------
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  ANTHROPIC_API_KEYS: commaSeparatedKeys.optional(),

  // --- OpenAI --------------------------------------------------------------------
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_API_KEYS: commaSeparatedKeys.optional(),

  // --- Google Gemini (native adapter) --------------------------------------------
  GOOGLE_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com'),
  GOOGLE_API_KEYS: commaSeparatedKeys.optional(),

  // --- Groq (OpenAI-compatible) --------------------------------------------------
  // URGENT: llama-3.3-70b-versatile was retired 16 Aug 2026. Default model is now
  // openai/gpt-oss-120b. The old model name will cause a 404; never use it.
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_API_KEYS: commaSeparatedKeys.optional(),
  GROQ_MODEL_ID: z.string().default('openai/gpt-oss-120b'),

  // --- Qwen via Alibaba Cloud DashScope (OpenAI-compatible) ----------------------
  DASHSCOPE_BASE_URL: z
    .string()
    .url()
    .default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  DASHSCOPE_API_KEYS: commaSeparatedKeys.optional(),

  // --- LM Studio (local OpenAI-compatible server) --------------------------------
  LM_STUDIO_BASE_URL: z.string().url().default('http://localhost:1234/v1'),
  LM_STUDIO_API_KEYS: commaSeparatedKeys.optional(),
  LM_STUDIO_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  // --- Ollama (local) ------------------------------------------------------------
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
  OLLAMA_API_KEYS: commaSeparatedKeys.optional(),

  // --- Ollama Cloud (hosted fallback) --------------------------------------------
  OLLAMA_CLOUD_BASE_URL: z.string().url().optional(),
  OLLAMA_CLOUD_API_KEYS: commaSeparatedKeys.optional(),

  // --- Genspark (research / agentic search tool) ---------------------------------
  GENSPARK_BASE_URL: z.string().url().default('https://api.genspark.ai/v1'),
  GENSPARK_API_KEYS: commaSeparatedKeys.optional(),
  GENSPARK_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // --- Azure OpenAI / Microsoft Copilot -----------------------------------------
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_KEYS: commaSeparatedKeys.optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-4o'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-08-01-preview'),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),

  // --- Legacy generic self-hosted server (kept for backwards compatibility) ------
  /** @deprecated Prefer named provider slots (LM_STUDIO_*, OLLAMA_*) over this. */
  LOCAL_MODEL_BASE_URL: z.string().url().optional(),
  /** @deprecated Prefer named provider slots (LM_STUDIO_*, OLLAMA_*) over this. */
  LOCAL_MODEL_API_KEYS: commaSeparatedKeys.optional(),

  // --- Provider selection --------------------------------------------------------
  /** Primary provider for CAPS-aligned curriculum requests. */
  AI_PROVIDER: z
    .enum([
      'claude',
      'gemini',
      'groq',
      'qwen',
      'lm-studio',
      'ollama',
      'genspark',
      'azure',
    ])
    .default('claude'),

  // --- Per-step model overrides (null = use provider default) --------------------
  STEP1_MODEL_ID: z.string().optional(),
  STEP2_MODEL_ID: z.string().optional(),
  STEP3_MODEL_ID: z.string().optional(),
  STEP4_MODEL_ID: z.string().optional(),
  STEP5_MODEL_ID: z.string().optional(),

  // --- Per-provider model defaults -----------------------------------------------
  CLAUDE_MODEL_ID: z.string().default('claude-sonnet-5'),
  CLAUDE_PREMIUM_MODEL_ID: z.string().default('claude-opus-5'),
  GEMINI_MODEL_ID: z.string().default('gemini-2.0-flash'),
  GEMINI_PREMIUM_MODEL_ID: z.string().default('gemini-2.5-pro'),

  // --- Routing (step 4) ----------------------------------------------------------
  /** Path to the routing JSON. Falls back to `DEFAULT_ROUTING_CONFIG` if unset. */
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
