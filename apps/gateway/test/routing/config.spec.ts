import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROUTING_CONFIG,
  InvalidRoutingConfigError,
  parseRoutingConfig,
} from '../../src/routing/config.js';

describe('parseRoutingConfig — happy path', () => {
  it('accepts a well-formed routing table', () => {
    const parsed = parseRoutingConfig({
      'plan.author': [
        { provider: 'anthropic', concreteModel: 'claude-sonnet' },
        { provider: 'openai', concreteModel: 'gpt-4o' },
      ],
    });
    expect(parsed['plan.author']).toHaveLength(2);
  });

  it('ships empty rather than guessing a provider nobody has configured', () => {
    // A non-empty default would have to name a provider, and a deployment that has not
    // configured that provider would fail to boot over a model nobody asked for — this
    // is exactly the bug an earlier draft had (a hard-coded "local" provider with no
    // adapter behind it). Empty is the only default that is safe for every deployment.
    expect(DEFAULT_ROUTING_CONFIG).toEqual({});
    expect(() => parseRoutingConfig(DEFAULT_ROUTING_CONFIG)).not.toThrow();
  });
});

describe('parseRoutingConfig — failure paths', () => {
  it('rejects a logical model name that is not "domain.action"', () => {
    expect(() =>
      parseRoutingConfig({
        PlanAuthor: [{ provider: 'openai', concreteModel: 'gpt-4o' }],
      }),
    ).toThrow(InvalidRoutingConfigError);
  });

  it('rejects an empty fallback chain', () => {
    expect(() => parseRoutingConfig({ 'plan.author': [] })).toThrow(
      InvalidRoutingConfigError,
    );
  });

  it('rejects a chain link missing a concrete model', () => {
    expect(() => parseRoutingConfig({ 'plan.author': [{ provider: 'openai' }] })).toThrow(
      InvalidRoutingConfigError,
    );
  });

  it('rejects a non-object candidate', () => {
    expect(() => parseRoutingConfig('not a routing table')).toThrow(
      InvalidRoutingConfigError,
    );
  });
});
