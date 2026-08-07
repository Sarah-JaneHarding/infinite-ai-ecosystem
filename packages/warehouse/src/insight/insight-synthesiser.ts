// DW-07 Insight Synthesiser — Stage 09 step 7.
//
// Generates one narrative insight per call, at learner, class, grade, or
// school level, by reasoning over de-identified domain events.
//
// Deterministic pre-checks (no/all-blocked events) run before the model is
// called.  Confidence score and metadata are computed without a model;
// narrative and sourceEventIds are produced by the injected InsightModelAdapter
// so the unit tier tests without a real model.
//
// Two outcomes via DW07Result:
//   ok          — insights array with ≥ 1 entry; each insight cites sourceEventIds
//   needs_input — no unblocked events found for the requested scope/domain/term

import type { DW07Input } from '../agent-inputs.js';
import type { DataDomain, DW07Result, Insight } from '../types.js';
import type { InsightScope } from '../types.js';

// ---------------------------------------------------------------------------
// Event shape (subset of domain_event_log exposed to this module)
// ---------------------------------------------------------------------------

/** A single conformed event from domain_event_log, as loaded for synthesis. */
export interface InsightEvent {
  readonly id: string;
  readonly domain: DataDomain;
  readonly eventType?: string;
  readonly occurredAt?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly blockedDownstream?: boolean;
}

// ---------------------------------------------------------------------------
// Store interface (injected; no direct DB import)
// ---------------------------------------------------------------------------

/** Events and optional expected-count for confidence-score computation. */
export interface InsightContext {
  readonly events: readonly InsightEvent[];
  /** When provided: confidenceScore = min(1, events / expectedDataPointCount). */
  readonly expectedDataPointCount?: number;
}

/**
 * Persistence boundary for DW-07.  The production adapter queries the
 * `domain_event_log` table through the tenant-scoped Prisma client.
 */
export interface InsightEventStore {
  loadContext(
    tenantId: string,
    scope: InsightScope,
    scopeId: string,
    domain: DataDomain,
    termNumber: number,
    academicYear: number,
  ): Promise<InsightContext>;
}

// ---------------------------------------------------------------------------
// Model adapter interface (injected; no direct gateway import)
// ---------------------------------------------------------------------------

/** Narrative and event citations returned by the model. */
export interface InsightModelOutput {
  readonly narrative: string;
  readonly sourceEventIds: readonly string[];
}

/**
 * Model boundary for DW-07.  The production adapter calls the Model Gateway;
 * tests inject a stub that returns a fixed InsightModelOutput.
 */
export interface InsightModelAdapter {
  synthesise(
    input: DW07Input,
    events: readonly InsightEvent[],
  ): Promise<InsightModelOutput>;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Materialises a single narrative insight from unblocked domain events.
 *
 * @param input   DW07 agent input (scope, domain, term).
 * @param store   Injected event store.
 * @param model   Injected model adapter (narrative + sourceEventIds).
 * @param now     ISO datetime used as generatedAt.  Inject in tests.
 */
export async function synthesiseInsight(
  input: DW07Input,
  store: InsightEventStore,
  model: InsightModelAdapter,
  now: string = new Date().toISOString(),
): Promise<DW07Result> {
  const { tenantId, scope, scopeId, domain, termNumber, academicYear } = input;

  const context = await store.loadContext(
    tenantId,
    scope,
    scopeId,
    domain,
    termNumber,
    academicYear,
  );

  const unblockedEvents = context.events.filter((e) => !e.blockedDownstream);

  if (unblockedEvents.length === 0) {
    const detail =
      context.events.length === 0
        ? `No events found for ${scope} ${scopeId} in domain ${domain} for term ${termNumber}/${academicYear}.`
        : `All events for ${scope} ${scopeId} in domain ${domain} were blocked by the quality gate.`;
    return { status: 'needs_input', scope, scopeId, detail };
  }

  const modelOutput = await model.synthesise(input, unblockedEvents);

  const dataPointCount = unblockedEvents.length;
  const expectedDataPointCount = context.expectedDataPointCount ?? dataPointCount;
  const confidenceScore =
    expectedDataPointCount > 0 ? Math.min(1, dataPointCount / expectedDataPointCount) : 0;

  const insight: Insight = {
    scope,
    scopeId,
    domain,
    narrative: modelOutput.narrative,
    confidenceScore,
    dataPointCount,
    sourceEventIds: [...modelOutput.sourceEventIds],
    generatedAt: now,
  };

  return { status: 'ok', insights: [insight] };
}
