import { describe, expect, it } from 'vitest';

import { GatewayCache, contentKey, idempotencyCacheKey } from '../../src/cache/cache.js';

describe('GatewayCache — happy path', () => {
  it('records a miss then a hit for an identical request within the TTL', () => {
    const cache = new GatewayCache({ ttlMs: 60_000 });
    const key = contentKey('tenant-1', 'plan.author', { messages: ['hi'] });

    expect(cache.lookup({ content: key })).toBeUndefined();
    expect(cache.stats).toEqual({ hits: 0, misses: 1 });

    cache.record({ content: key }, { text: 'cached result' });
    expect(cache.lookup({ content: key })).toEqual({ text: 'cached result' });
    expect(cache.stats).toEqual({ hits: 1, misses: 1 });
  });

  it('prevents a duplicate charge on retry via the idempotency key, even with a different content key', () => {
    const cache = new GatewayCache();
    const idempotency = idempotencyCacheKey('tenant-1', 'retry-abc');
    cache.record(
      { content: contentKey('tenant-1', 'plan.author', { a: 1 }), idempotency },
      'first-result',
    );

    // A retry might carry a slightly different content key (e.g. a timestamp in params)
    // but the same idempotency key, and must still see the original result.
    const hit = cache.lookup({
      content: contentKey('tenant-1', 'plan.author', { a: 2 }),
      idempotency,
    });
    expect(hit).toBe('first-result');
  });

  it('scopes the content key by tenant, so two tenants never share a cache entry', () => {
    const params = { messages: ['same prompt'] };
    const keyA = contentKey('tenant-a', 'plan.author', params);
    const keyB = contentKey('tenant-b', 'plan.author', params);
    expect(keyA).not.toBe(keyB);
  });
});

describe('GatewayCache — failure/edge paths', () => {
  it('treats an expired entry as a miss', () => {
    let now = 0;
    const cache = new GatewayCache({ ttlMs: 1000, now: () => now });
    const key = contentKey('tenant-1', 'plan.author', {});
    cache.record({ content: key }, 'value');
    expect(cache.lookup({ content: key })).toBe('value');

    now = 1001;
    expect(cache.lookup({ content: key })).toBeUndefined();
    expect(cache.stats.misses).toBe(1);
  });

  it('does not hit on a content key collision across different logical models', () => {
    const forChat = contentKey('tenant-1', 'plan.author', { x: 1 });
    const forEmbed = contentKey('tenant-1', 'embed.default', { x: 1 });
    expect(forChat).not.toBe(forEmbed);
  });
});
