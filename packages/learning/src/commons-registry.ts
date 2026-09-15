// Commons Registry — Stage 13 step 7.
//
// Outer LE-08 function wrapping the lower-level decideCommonPublication with full
// LE08-shaped input/output, and a PublishedPatternRegistry that tracks every
// published-to-commons entry for the published-pattern registry.
//
// k-anonymity threshold: COMMONS_K_ANONYMITY_THRESHOLD (5 distinct tenants).
// A pattern below the threshold, or from a tenant that has not opted in, is suppressed.

import type { MinedPattern, PublishedPattern } from '@infinite-ai/contracts';
import { COMMONS_K_ANONYMITY_THRESHOLD } from '@infinite-ai/contracts';

import { decideCommonPublication } from './commons-publisher.js';

export interface PublishToCommonsInput {
  readonly publishingTenantId: string;
  readonly tenantOptIn: boolean;
  /** Absent triggers needs_input. */
  readonly pattern?: MinedPattern;
  readonly contributingTenantRefs: readonly string[];
  /** ISO-8601 datetime injected for deterministic testing. */
  readonly now: string;
  /** Injected UUID generator — use `crypto.randomUUID` in production. */
  readonly idGenerator: () => string;
}

export type CommonsPublisherDecision =
  | {
      readonly status: 'published';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly publishedPattern: PublishedPattern;
    }
  | {
      readonly status: 'suppressed_below_threshold';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly contributingTenantCount: number;
      readonly required: typeof COMMONS_K_ANONYMITY_THRESHOLD;
      readonly detail: string;
    }
  | {
      readonly status: 'suppressed_no_opt_in';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly detail: string;
    }
  | {
      readonly status: 'needs_input';
      readonly tenantId: string;
      readonly processedAt: string;
      readonly detail: string;
      readonly missingFields: readonly string[];
    };

/**
 * Attempts to publish a mined pattern to the cross-school commons.
 *
 * Returns `needs_input` when required fields are absent; `suppressed_no_opt_in`
 * when the tenant has not opted in; `suppressed_below_threshold` when fewer than
 * COMMONS_K_ANONYMITY_THRESHOLD distinct tenants contributed; `published` with a
 * full PublishedPattern when all checks pass.
 */
export function publishToCommons(input: PublishToCommonsInput): CommonsPublisherDecision {
  const missingFields: string[] = [];
  if (!input.pattern) missingFields.push('pattern');
  if (!input.publishingTenantId) missingFields.push('publishingTenantId');
  if (input.contributingTenantRefs.length === 0)
    missingFields.push('contributingTenantRefs');

  if (missingFields.length > 0) {
    return {
      status: 'needs_input',
      tenantId: input.publishingTenantId,
      processedAt: input.now,
      detail: `Missing required fields: ${missingFields.join(', ')}.`,
      missingFields,
    };
  }

  const decision = decideCommonPublication(
    input.tenantOptIn,
    input.contributingTenantRefs,
  );

  if (!decision.allowed) {
    if (decision.reason === 'no_opt_in') {
      return {
        status: 'suppressed_no_opt_in',
        tenantId: input.publishingTenantId,
        processedAt: input.now,
        detail:
          'Publishing tenant has not opted in to cross-school commons contribution.',
      };
    }
    return {
      status: 'suppressed_below_threshold',
      tenantId: input.publishingTenantId,
      processedAt: input.now,
      contributingTenantCount: decision.contributingTenantCount,
      required: COMMONS_K_ANONYMITY_THRESHOLD,
      detail: `Pattern has ${decision.contributingTenantCount} contributing tenant(s); minimum is ${COMMONS_K_ANONYMITY_THRESHOLD}.`,
    };
  }

  const pattern = input.pattern as MinedPattern;
  const publishedPattern: PublishedPattern = {
    publishedPatternId: input.idGenerator(),
    patternId: pattern.patternId,
    capsTopicId: pattern.capsTopicId,
    agentId: pattern.agentId,
    effectSize: pattern.effectSize,
    confidenceInterval: pattern.confidenceInterval,
    contributingTenantCount: decision.contributingTenantCount,
    publishedAt: input.now,
  };

  return {
    status: 'published',
    tenantId: input.publishingTenantId,
    processedAt: input.now,
    publishedPattern,
  };
}

/** Append-only registry of every pattern published to the cross-school commons. */
export class PublishedPatternRegistry {
  private readonly entries: PublishedPattern[] = [];

  /** Records a published pattern. */
  append(pattern: PublishedPattern): void {
    this.entries.push(pattern);
  }

  /** Returns all published patterns, oldest first. */
  allEntries(): readonly PublishedPattern[] {
    return this.entries;
  }

  /** Returns true if any publication exists for this patternId. */
  hasPattern(patternId: string): boolean {
    return this.entries.some((e) => e.patternId === patternId);
  }

  /** Returns the published entry for a given publishedPatternId, or null. */
  findByPublishedId(publishedPatternId: string): PublishedPattern | null {
    return this.entries.find((e) => e.publishedPatternId === publishedPatternId) ?? null;
  }
}
