// Derives a single-provider routing table from the shipped one — so a developer with one
// free OpenAI-compatible endpoint (Ollama, LM Studio, vLLM) can boot the gateway, which
// refuses to start unless every provider named in its routing file has credentials.
//
// Like `routing.anthropic.json`, the result is never an independent routing policy: the set
// of logical models and their order of importance come from `routing.json`. Only the
// provider and the concrete model are replaced. A route whose first link is Anthropic is a
// "heavy" route (planning, authoring, analysis); every other first link is a "light" one
// (screening, classification), so a small model can serve the light routes and a larger one
// the heavy routes.

import type { RoutingLink } from './config.js';

export interface SingleProviderOptions {
  readonly provider: string;
  readonly heavyModel: string;
  readonly lightModel: string;
  /** Concrete model for `embedding.encode`; the embedding route is dropped when absent. */
  readonly embeddingModel?: string;
  /** Overrides the model for named logical models, e.g. the age-appropriateness judge. */
  readonly overrides?: Readonly<Record<string, string>>;
}

export class InvalidSingleProviderOptionsError extends Error {
  public override readonly name = 'InvalidSingleProviderOptionsError';
}

const EMBEDDING = 'embedding.encode';

export function deriveSingleProviderRouting(
  shipped: Readonly<Record<string, readonly RoutingLink[]>>,
  options: SingleProviderOptions,
): Record<string, readonly RoutingLink[]> {
  for (const [label, value] of [
    ['provider', options.provider],
    ['heavyModel', options.heavyModel],
    ['lightModel', options.lightModel],
  ] as const) {
    if (value.trim().length === 0) {
      throw new InvalidSingleProviderOptionsError(`${label} must not be empty`);
    }
  }
  const unknown = Object.keys(options.overrides ?? {}).filter(
    (name) => !(name in shipped),
  );
  if (unknown.length > 0) {
    throw new InvalidSingleProviderOptionsError(
      `override for unknown logical model(s): ${unknown.join(', ')}`,
    );
  }

  const derived: Record<string, readonly RoutingLink[]> = {};
  for (const [logicalModel, chain] of Object.entries(shipped)) {
    if (logicalModel === EMBEDDING) {
      if (options.embeddingModel !== undefined) {
        derived[logicalModel] = [
          { provider: options.provider, concreteModel: options.embeddingModel },
        ];
      }
      continue;
    }
    const heavy = chain[0]?.provider === 'anthropic';
    derived[logicalModel] = [
      {
        provider: options.provider,
        concreteModel:
          options.overrides?.[logicalModel] ??
          (heavy ? options.heavyModel : options.lightModel),
      },
    ];
  }
  return derived;
}
