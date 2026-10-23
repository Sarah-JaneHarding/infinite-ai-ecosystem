import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseRoutingConfig } from '../../src/routing/config.js';
import {
  InvalidSingleProviderOptionsError,
  deriveSingleProviderRouting,
} from '../../src/routing/single-provider.js';

const shipped = parseRoutingConfig(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../routing.json', import.meta.url)), 'utf8'),
  ),
);
const base = { provider: 'local', heavyModel: 'big', lightModel: 'small' } as const;

describe('deriveSingleProviderRouting', () => {
  it('keeps every logical model but the embedding one, each served by one link', () => {
    const derived = deriveSingleProviderRouting(shipped, base);
    expect(Object.keys(derived).sort()).toEqual(
      Object.keys(shipped)
        .filter((k) => k !== 'embedding.encode')
        .sort(),
    );
    for (const chain of Object.values(derived)) {
      expect(chain).toHaveLength(1);
      expect(chain[0]?.provider).toBe('local');
    }
    expect(parseRoutingConfig(derived)).toEqual(derived);
  });

  it('sends Anthropic-first routes to the heavy model and the rest to the light one', () => {
    const derived = deriveSingleProviderRouting(shipped, base);
    expect(derived['plan.author']?.[0]?.concreteModel).toBe('big');
    expect(derived['support.screen']?.[0]?.concreteModel).toBe('small');
  });

  it('applies an override, e.g. a stronger model for the age-appropriateness judge', () => {
    const derived = deriveSingleProviderRouting(shipped, {
      ...base,
      embeddingModel: 'embed',
      overrides: { 'guardrail.age_appropriateness': 'judge' },
    });
    expect(derived['guardrail.age_appropriateness']?.[0]?.concreteModel).toBe('judge');
    expect(derived['embedding.encode']?.[0]?.concreteModel).toBe('embed');
  });

  it('refuses an empty model name', () => {
    expect(() =>
      deriveSingleProviderRouting(shipped, { ...base, heavyModel: ' ' }),
    ).toThrow(InvalidSingleProviderOptionsError);
  });

  it('refuses an override for a logical model that does not exist', () => {
    expect(() =>
      deriveSingleProviderRouting(shipped, {
        ...base,
        overrides: { 'nope.nothing': 'x' },
      }),
    ).toThrow(/unknown logical model/);
  });
});
