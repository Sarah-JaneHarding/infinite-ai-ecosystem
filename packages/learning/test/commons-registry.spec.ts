// Commons Registry unit tests — Stage 13 step 7.
//
// "Build LE-08 with k-anonymity enforcement and a published-pattern registry"
// (manual step 7). Covers publishToCommons and PublishedPatternRegistry.

import { COMMONS_K_ANONYMITY_THRESHOLD } from '@infinite-ai/contracts';
import { describe, expect, it } from 'vitest';

import {
  PublishedPatternRegistry,
  type PublishToCommonsInput,
  publishToCommons,
} from '../src/index.js';

const PATTERN = {
  patternId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  capsTopicId: 'MATH-GR4-NUM',
  agentId: 'agent-le04',
  sampleSize: 12,
  effectSize: 0.18,
  confidenceInterval: [0.05, 0.31] as [number, number],
  biasChecked: true,
  minedAt: '2026-09-01T08:00:00.000Z',
};

const TENANT_REFS = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
];

const BASE: PublishToCommonsInput = {
  publishingTenantId: '00000000-0000-0000-0000-000000000001',
  tenantOptIn: true,
  pattern: PATTERN,
  contributingTenantRefs: TENANT_REFS,
  now: '2026-09-15T10:00:00.000Z',
  idGenerator: () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

describe('publishToCommons', () => {
  it('returns published when opt-in and k-anonymity threshold are met', () => {
    const result = publishToCommons(BASE);
    expect(result.status).toBe('published');
    if (result.status !== 'published') return;
    expect(result.publishedPattern.patternId).toBe(PATTERN.patternId);
    expect(result.publishedPattern.contributingTenantCount).toBe(TENANT_REFS.length);
    expect(result.publishedPattern.publishedAt).toBe(BASE.now);
    expect(result.tenantId).toBe(BASE.publishingTenantId);
    expect(result.processedAt).toBe(BASE.now);
  });

  it('published pattern carries pattern fields from MinedPattern', () => {
    const result = publishToCommons(BASE);
    expect(result.status).toBe('published');
    if (result.status !== 'published') return;
    expect(result.publishedPattern.capsTopicId).toBe(PATTERN.capsTopicId);
    expect(result.publishedPattern.agentId).toBe(PATTERN.agentId);
    expect(result.publishedPattern.effectSize).toBe(PATTERN.effectSize);
    expect(result.publishedPattern.confidenceInterval).toEqual(
      PATTERN.confidenceInterval,
    );
  });

  it('publishedPatternId comes from idGenerator', () => {
    const result = publishToCommons(BASE);
    expect(result.status).toBe('published');
    if (result.status !== 'published') return;
    expect(result.publishedPattern.publishedPatternId).toBe(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
  });

  it('returns suppressed_no_opt_in when tenantOptIn is false', () => {
    const result = publishToCommons({ ...BASE, tenantOptIn: false });
    expect(result.status).toBe('suppressed_no_opt_in');
    if (result.status !== 'suppressed_no_opt_in') return;
    expect(result.detail).toMatch(/opted in/i);
  });

  it('returns suppressed_below_threshold when fewer than threshold tenants contributed', () => {
    const result = publishToCommons({
      ...BASE,
      contributingTenantRefs: TENANT_REFS.slice(0, COMMONS_K_ANONYMITY_THRESHOLD - 1),
    });
    expect(result.status).toBe('suppressed_below_threshold');
    if (result.status !== 'suppressed_below_threshold') return;
    expect(result.contributingTenantCount).toBe(COMMONS_K_ANONYMITY_THRESHOLD - 1);
    expect(result.required).toBe(COMMONS_K_ANONYMITY_THRESHOLD);
  });

  it('returns needs_input when pattern is absent', () => {
    const input: PublishToCommonsInput = {
      publishingTenantId: BASE.publishingTenantId,
      tenantOptIn: true,
      contributingTenantRefs: TENANT_REFS,
      now: BASE.now,
      idGenerator: BASE.idGenerator,
    };
    const result = publishToCommons(input);
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('pattern');
  });

  it('returns needs_input when contributingTenantRefs is empty', () => {
    const result = publishToCommons({ ...BASE, contributingTenantRefs: [] });
    expect(result.status).toBe('needs_input');
    if (result.status !== 'needs_input') return;
    expect(result.missingFields).toContain('contributingTenantRefs');
  });

  it('suppressed_below_threshold detail names the counts', () => {
    const result = publishToCommons({
      ...BASE,
      contributingTenantRefs: TENANT_REFS.slice(0, 2),
    });
    expect(result.status).toBe('suppressed_below_threshold');
    if (result.status !== 'suppressed_below_threshold') return;
    expect(result.detail).toMatch(/2/);
    expect(result.detail).toMatch(new RegExp(String(COMMONS_K_ANONYMITY_THRESHOLD)));
  });
});

describe('PublishedPatternRegistry', () => {
  const makePublished = (id: string, patternId: string) => ({
    publishedPatternId: id,
    patternId,
    capsTopicId: 'MATH-GR4-NUM',
    agentId: 'agent-le04',
    effectSize: 0.18,
    confidenceInterval: [0.05, 0.31] as [number, number],
    contributingTenantCount: 5,
    publishedAt: '2026-09-15T10:00:00.000Z',
  });

  it('appended entries appear in allEntries', () => {
    const registry = new PublishedPatternRegistry();
    registry.append(makePublished('pub-01', 'pat-01'));
    expect(registry.allEntries()).toHaveLength(1);
  });

  it('hasPattern returns true after a pattern is appended', () => {
    const registry = new PublishedPatternRegistry();
    registry.append(makePublished('pub-01', 'pat-01'));
    expect(registry.hasPattern('pat-01')).toBe(true);
  });

  it('hasPattern returns false for a pattern that was not appended', () => {
    const registry = new PublishedPatternRegistry();
    expect(registry.hasPattern('pat-99')).toBe(false);
  });

  it('findByPublishedId returns the correct entry', () => {
    const registry = new PublishedPatternRegistry();
    const entry = makePublished('pub-01', 'pat-01');
    registry.append(entry);
    expect(registry.findByPublishedId('pub-01')?.patternId).toBe('pat-01');
  });

  it('findByPublishedId returns null for an unknown id', () => {
    const registry = new PublishedPatternRegistry();
    expect(registry.findByPublishedId('unknown')).toBeNull();
  });
});
