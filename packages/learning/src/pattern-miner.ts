// Pattern Miner — Stage 13 step 3.
//
// Pure pattern-mining logic extracted from LE-04's rules so they can be unit-tested
// deterministically.
//
// Manual rule (§13 step 3): "Mine effect sizes and confidence intervals from attributed
// outcomes; enforce a minimum sample threshold; never promote a pattern with a sample
// below PATTERN_MIN_SAMPLE_SIZE."
//
// A bias check is performed when stratificationFields are declared. Without per-attribution
// group labels in the current schema, divergence is detected as high coefficient of
// variation across the attribution set's score deltas (std > |mean|). A divergent
// pattern is counted and excluded from results — it must not be promoted.
//
// `patternId` and `minedAt` are injected via `PatternMinerInput` for deterministic testing;
// callers supply `crypto.randomUUID` and `new Date().toISOString()` in production.

import type { AttributionMethod } from '@infinite-ai/contracts';

import { PATTERN_MIN_SAMPLE_SIZE } from '@infinite-ai/contracts';

export interface PatternMinerAttribution {
  readonly artefactId: string;
  readonly agentId: string;
  readonly method: AttributionMethod;
  readonly confidence: number;
  readonly cohortSize: number;
  readonly meanScoreDelta: number | null;
}

export interface PatternMinerInput {
  readonly capsTopicId: string;
  readonly attributions: readonly PatternMinerAttribution[];
  readonly stratificationFields: readonly string[];
  /** ISO-8601 datetime stamped on every mined pattern. */
  readonly now: string;
  /** Injected UUID generator — use `crypto.randomUUID` in production. */
  readonly idGenerator: () => string;
}

export interface MinedPatternResult {
  readonly patternId: string;
  readonly agentId: string;
  readonly sampleSize: number;
  readonly effectSize: number;
  readonly confidenceInterval: readonly [number, number];
  readonly biasChecked: boolean;
  readonly biasDivergenceNote?: string;
  readonly minedAt: string;
}

export type PatternMinerDecision =
  | {
      readonly status: 'ok';
      readonly capsTopicId: string;
      readonly patterns: readonly MinedPatternResult[];
      readonly patternsBlockedForBiasDivergence: number;
    }
  | {
      readonly status: 'below_threshold';
      readonly required: typeof PATTERN_MIN_SAMPLE_SIZE;
      readonly actual: number;
    }
  | {
      readonly status: 'needs_input';
      readonly missingFields: readonly string[];
    };

function mean(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Mines a pattern for one agent's attribution group.
 *
 * Returns `null` (pattern blocked) when bias divergence is detected and stratification
 * fields were declared.
 */
function mineOnePattern(
  agentId: string,
  group: readonly PatternMinerAttribution[],
  stratificationFields: readonly string[],
  now: string,
  idGenerator: () => string,
): MinedPatternResult | null {
  const nonNullDeltas = group
    .map((a) => a.meanScoreDelta)
    .filter((d): d is number => d !== null);

  const effectSize = nonNullDeltas.length > 0 ? mean(nonNullDeltas) : 0;
  const se =
    nonNullDeltas.length >= 2
      ? stddev(nonNullDeltas) / Math.sqrt(nonNullDeltas.length)
      : 0;
  const margin = 1.96 * se;

  const biasChecked = stratificationFields.length > 0;

  if (biasChecked && nonNullDeltas.length >= 2) {
    const std = stddev(nonNullDeltas);
    // High coefficient of variation: std exceeds the absolute effect size, indicating
    // the effect is not consistent across the attribution set. Without per-attribution
    // group labels the check is structural — a real stratum-level check requires richer
    // data (OQ-016's calibration pipeline will revisit this).
    if (std > Math.abs(effectSize) && std > 0) {
      return null; // blocked for bias divergence
    }
  }

  return {
    patternId: idGenerator(),
    agentId,
    sampleSize: group.length,
    effectSize,
    confidenceInterval: [effectSize - margin, effectSize + margin],
    biasChecked,
    minedAt: now,
  };
}

/**
 * Mines patterns from a set of attributed outcomes.
 *
 * Returns `needs_input` when no attributions are supplied; `below_threshold` when the
 * total attribution count is below `PATTERN_MIN_SAMPLE_SIZE`; otherwise `ok` with one
 * pattern per agent that meets the minimum threshold. Agents below the per-agent
 * threshold within an otherwise sufficient total are quietly excluded from the result —
 * they do not count toward blocked patterns.
 */
export function minePatterns(input: PatternMinerInput): PatternMinerDecision {
  if (input.attributions.length === 0) {
    return {
      status: 'needs_input',
      missingFields: ['attributions'],
    };
  }

  if (input.attributions.length < PATTERN_MIN_SAMPLE_SIZE) {
    return {
      status: 'below_threshold',
      required: PATTERN_MIN_SAMPLE_SIZE,
      actual: input.attributions.length,
    };
  }

  // Group by agentId — each agent gets its own pattern.
  const byAgent = new Map<string, PatternMinerAttribution[]>();
  for (const attr of input.attributions) {
    const existing = byAgent.get(attr.agentId);
    if (existing !== undefined) {
      existing.push(attr);
    } else {
      byAgent.set(attr.agentId, [attr]);
    }
  }

  const patterns: MinedPatternResult[] = [];
  let blockedCount = 0;

  for (const [agentId, group] of byAgent) {
    if (group.length < PATTERN_MIN_SAMPLE_SIZE) {
      // Not enough data for this specific agent — skip silently (no pattern, not blocked).
      continue;
    }

    const result = mineOnePattern(
      agentId,
      group,
      input.stratificationFields,
      input.now,
      input.idGenerator,
    );

    if (result === null) {
      blockedCount += 1;
    } else {
      patterns.push(result);
    }
  }

  if (patterns.length === 0 && blockedCount === 0) {
    // All agent groups were below their per-agent threshold despite the total meeting the
    // global minimum — the total came from many small groups, none individually sufficient.
    return {
      status: 'below_threshold',
      required: PATTERN_MIN_SAMPLE_SIZE,
      actual: input.attributions.length,
    };
  }

  return {
    status: 'ok',
    capsTopicId: input.capsTopicId,
    patterns,
    patternsBlockedForBiasDivergence: blockedCount,
  };
}
