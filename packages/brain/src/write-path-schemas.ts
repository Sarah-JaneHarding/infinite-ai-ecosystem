// The "extracted+typed" transition's typing rules — Stage 05 step 2.
//
// A candidate's `rawPayload` is whatever the caller submitted; this module is the one
// place that decides whether it is shaped like a fact the target tier can actually hold.
// Rule 8: `unknown` plus a Zod parse, never a cast.

import { z } from 'zod';

const BrainConstitutionKind = z.enum([
  'SCHOOL_POLICY',
  'CAPS_CANON',
  'ATP_CALENDAR',
  'TEMPLATE',
  'ASSESSMENT_POLICY',
  'POPIA_RULE',
  'HOUSE_VOICE',
]);

const BrainEntityType = z.enum([
  'LEARNER',
  'CLASS',
  'SUBJECT',
  'TOPIC',
  'CAPS_CODE',
  'ASSESSMENT',
  'INTERVENTION',
  'RESOURCE',
  'STAFF_MEMBER',
  'DOCUMENT',
]);

const BrainProcedureKind = z.enum([
  'PROMPT_VERSION',
  'PIPELINE_DEFINITION',
  'SOP',
  'EXEMPLAR',
  'TOOL_CONTRACT',
]);

const UUID = z.string().uuid();

/** L0 Constitution — a policy fact, keyed by `key` and versioned by the write path. */
export const L0ConstitutionPayload = z.object({
  key: z.string().min(1),
  kind: BrainConstitutionKind,
  content: z.unknown(),
});
export type L0ConstitutionPayload = z.infer<typeof L0ConstitutionPayload>;

/** L3 Procedural — a prompt version, pipeline, SOP, exemplar or tool contract. */
export const L3ProcedurePayload = z.object({
  kind: BrainProcedureKind,
  ref: z.string().min(1),
  content: z.unknown(),
});
export type L3ProcedurePayload = z.infer<typeof L3ProcedurePayload>;

/** L1 Semantic — an entity. `externalRef` is the dedup key when the entity has one. */
export const L1NodePayload = z.object({
  entityType: BrainEntityType,
  externalRef: z.string().min(1).nullable().default(null),
  label: z.string().min(1),
  attributes: z.record(z.unknown()).default({}),
  /** The node this candidate corrects or replaces. Only ever declared, never inferred. */
  supersedes: UUID.nullable().default(null),
});
export type L1NodePayload = z.infer<typeof L1NodePayload>;

/** L1 Semantic — a typed relation between two already-committed nodes. */
export const L1EdgePayload = z.object({
  sourceId: UUID,
  targetId: UUID,
  relation: z.string().min(1),
  attributes: z.record(z.unknown()).default({}),
  supersedes: UUID.nullable().default(null),
});
export type L1EdgePayload = z.infer<typeof L1EdgePayload>;

/**
 * L2 Episodic. `supersedes` is how a human correction is expressed — "what did we think
 * happened, and what do we now know" both stay readable, per the schema's own comment on
 * `BrainEpisode`. An episode with no `supersedes` is simply a new event, which is the
 * common case; episodes have no natural key of their own to detect a conflict against.
 */
export const L2EpisodePayload = z.object({
  eventType: z.string().min(1),
  subjectNodeId: UUID.nullable().default(null),
  actorId: UUID.nullable().default(null),
  occurredAt: z.coerce.date(),
  summary: z.string().min(1),
  detail: z.record(z.unknown()).default({}),
  outcome: z.string().nullable().default(null),
  supersedes: UUID.nullable().default(null),
});
export type L2EpisodePayload = z.infer<typeof L2EpisodePayload>;

export type BrainTargetTier =
  'L0_CONSTITUTION' | 'L1_NODE' | 'L1_EDGE' | 'L2_EPISODE' | 'L3_PROCEDURE';

export type ExtractedPayload =
  | { readonly targetTier: 'L0_CONSTITUTION'; readonly payload: L0ConstitutionPayload }
  | { readonly targetTier: 'L1_NODE'; readonly payload: L1NodePayload }
  | { readonly targetTier: 'L1_EDGE'; readonly payload: L1EdgePayload }
  | { readonly targetTier: 'L2_EPISODE'; readonly payload: L2EpisodePayload }
  | { readonly targetTier: 'L3_PROCEDURE'; readonly payload: L3ProcedurePayload };

export class BrainExtractionError extends Error {
  public override readonly name = 'BrainExtractionError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Parses and validates a candidate's `rawPayload` against its target tier's shape.
 *
 * This *is* the "extracted+typed" transition's content — everything `advanceBrainWrite`
 * needs to persist that step is this function's return value.
 */
export function extractTyped(
  targetTier: BrainTargetTier,
  rawPayload: unknown,
): ExtractedPayload {
  switch (targetTier) {
    case 'L0_CONSTITUTION':
      return {
        targetTier,
        payload: unwrap(L0ConstitutionPayload.safeParse(rawPayload), targetTier),
      };
    case 'L3_PROCEDURE':
      return {
        targetTier,
        payload: unwrap(L3ProcedurePayload.safeParse(rawPayload), targetTier),
      };
    case 'L1_NODE':
      return {
        targetTier,
        payload: unwrap(L1NodePayload.safeParse(rawPayload), targetTier),
      };
    case 'L1_EDGE':
      return {
        targetTier,
        payload: unwrap(L1EdgePayload.safeParse(rawPayload), targetTier),
      };
    case 'L2_EPISODE':
      return {
        targetTier,
        payload: unwrap(L2EpisodePayload.safeParse(rawPayload), targetTier),
      };
  }
}

/** Unwraps a `safeParse` result, or throws with which tier and why. */
function unwrap<Output>(
  result: z.SafeParseReturnType<unknown, Output>,
  targetTier: BrainTargetTier,
): Output {
  if (!result.success) {
    throw new BrainExtractionError(
      `${targetTier} candidate failed extraction: ${result.error.message}`,
    );
  }
  return result.data;
}
