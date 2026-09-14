// Provider selection and per-step model mapping — ingested from the AI Provider Hub.
//
// "Provider is data, not code" (mirrors the routing config principle). Changing which
// provider serves curriculum steps is a change to environment variables reviewed like any
// other config change, not a code change here.
//
// GROQ MIGRATION NOTE: llama-3.3-70b-versatile was retired 16 August 2026.
// Any reference to that model name will return 404 from the Groq API. The default for
// GROQ_MODEL_ID is now openai/gpt-oss-120b, set in GatewayEnvSchema.

import { loadGatewayEnv } from './env.js';

export type ProviderId =
  'claude' | 'gemini' | 'groq' | 'qwen' | 'lm-studio' | 'ollama' | 'genspark' | 'azure';

export interface ProviderDefaults {
  /** Adapter key used in the gateway adapter registry. */
  adapterKey: string;
  /** Default concrete model name sent to the provider API. */
  defaultModel: string;
  /** Premium/complex-task model — used for Opus-tier requests. */
  premiumModel?: string;
  /** Base URL override (uses env value when present, else the Zod default). */
  baseUrl?: string | undefined;
  /** Request timeout in milliseconds, for slow local servers. */
  timeoutMs?: number | undefined;
}

/** Returns the resolved provider configuration for all enabled providers. */
export function getProviderDefaults(): Record<ProviderId, ProviderDefaults> {
  const env = loadGatewayEnv();

  return {
    claude: {
      adapterKey: 'anthropic',
      defaultModel: env.CLAUDE_MODEL_ID,
      premiumModel: env.CLAUDE_PREMIUM_MODEL_ID,
      baseUrl: env.ANTHROPIC_BASE_URL,
    },
    gemini: {
      adapterKey: 'google',
      defaultModel: env.GEMINI_MODEL_ID,
      premiumModel: env.GEMINI_PREMIUM_MODEL_ID,
      baseUrl: env.GOOGLE_BASE_URL,
    },
    groq: {
      adapterKey: 'openai-compatible',
      defaultModel: env.GROQ_MODEL_ID,
      baseUrl: env.GROQ_BASE_URL,
    },
    qwen: {
      adapterKey: 'openai-compatible',
      defaultModel: 'qwen-plus',
      baseUrl: env.DASHSCOPE_BASE_URL,
    },
    'lm-studio': {
      adapterKey: 'openai-compatible',
      defaultModel: 'loaded-model',
      baseUrl: env.LM_STUDIO_BASE_URL,
      timeoutMs: env.LM_STUDIO_TIMEOUT_MS,
    },
    ollama: {
      adapterKey: 'openai-compatible',
      defaultModel: 'llama3.2',
      baseUrl: env.OLLAMA_BASE_URL,
    },
    genspark: {
      adapterKey: 'openai-compatible',
      defaultModel: 'genspark-mini',
      baseUrl: env.GENSPARK_BASE_URL,
      timeoutMs: env.GENSPARK_TIMEOUT_MS,
    },
    azure: {
      adapterKey: 'openai-compatible',
      defaultModel: env.AZURE_OPENAI_DEPLOYMENT,
      baseUrl: env.AZURE_OPENAI_ENDPOINT,
    },
  };
}

/** The active provider for this deployment, resolved from AI_PROVIDER env var. */
export function getActiveProvider(): ProviderId {
  return loadGatewayEnv().AI_PROVIDER as ProviderId;
}

/**
 * The concrete model for a numbered curriculum step (1–5).
 *
 * Resolution order:
 *   1. STEP{N}_MODEL_ID env override
 *   2. Provider default for the active provider
 *
 * Steps are semantically:
 *   1 = curriculum plan / complex reasoning  → premium model
 *   2 = content generation                   → standard model
 *   3 = assessment / marking                 → standard model
 *   4 = analytics / reporting                → premium model
 *   5 = utility / fast tasks                 → standard/fast model
 */
export function getStepModel(step: 1 | 2 | 3 | 4 | 5): string {
  const env = loadGatewayEnv();
  const provider = getActiveProvider();
  const defaults = getProviderDefaults()[provider];

  const overrides: Record<number, string | undefined> = {
    1: env.STEP1_MODEL_ID,
    2: env.STEP2_MODEL_ID,
    3: env.STEP3_MODEL_ID,
    4: env.STEP4_MODEL_ID,
    5: env.STEP5_MODEL_ID,
  };

  const override = overrides[step];
  if (override) return override;

  // Steps 1 and 4 use the premium model when the provider has one.
  if ((step === 1 || step === 4) && defaults.premiumModel) {
    return defaults.premiumModel;
  }

  return defaults.defaultModel;
}
