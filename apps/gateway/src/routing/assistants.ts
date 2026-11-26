// Turns the assistant connector registry into routing — one link per connector, and only
// for connectors whose credentials this deployment actually has.
//
// The router refuses to boot if a routing file names a provider with no adapter, so a
// static file listing all five assistants would force every deployment to hold five
// vendors' keys. Deriving from the live adapter registry means a Claude-only school gets
// exactly one picker entry, and the rest simply do not exist for it.

import { ASSISTANT_CONNECTORS, type AssistantProvider } from '@infinite-ai/contracts';

import type { ProviderAdapter } from '../adapters/types.js';
import type { GatewayEnv } from '../config/env.js';
import type { RoutingLink } from './config.js';

type ModelEnv = Pick<
  GatewayEnv,
  | 'CLAUDE_MODEL_ID'
  | 'GEMINI_MODEL_ID'
  | 'AZURE_OPENAI_DEPLOYMENT'
  | 'QWEN_MODEL_ID'
  | 'GROK_MODEL_ID'
>;

function concreteModelFor(id: AssistantProvider, env: ModelEnv): string {
  switch (id) {
    case 'claude':
      return env.CLAUDE_MODEL_ID;
    case 'gemini':
      return env.GEMINI_MODEL_ID;
    case 'copilot':
      return env.AZURE_OPENAI_DEPLOYMENT;
    case 'qwen':
      return env.QWEN_MODEL_ID;
    case 'grok':
      return env.GROK_MODEL_ID;
  }
}

export function buildAssistantRouting(
  env: ModelEnv,
  adapters: Readonly<Record<string, ProviderAdapter>>,
): Record<string, readonly RoutingLink[]> {
  const routing: Record<string, readonly RoutingLink[]> = {};
  for (const connector of ASSISTANT_CONNECTORS) {
    if (adapters[connector.gatewayProvider] === undefined) continue;
    routing[connector.logicalModel] = [
      {
        provider: connector.gatewayProvider,
        concreteModel: concreteModelFor(connector.id, env),
      },
    ];
  }
  return routing;
}
