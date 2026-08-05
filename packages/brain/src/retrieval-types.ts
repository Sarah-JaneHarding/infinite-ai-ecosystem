// Shared shapes for the retrieval path — Stage 05 step 4.
//
// `query → intent router → policy + RBAC + purpose gate → vector top-k → graph n-hop
// expansion → episodic temporal filter → rerank → token-budgeted context assembly`.

import type { ConsentEntry, DataCategory, Purpose } from '@infinite-ai/contracts';
import type { Actor, Resource } from '@infinite-ai/policy';

import type { BrainConstitutionKind, BrainEntityType } from './write-path-schemas.js';

/** What a retrieval is about, for the purpose/consent gate — null when it is not about
 * any single data subject (curriculum canon, a topic, a CAPS code). */
export interface RetrievalSubject {
  readonly subjectToken: string;
  readonly requestedCategories: readonly DataCategory[];
  readonly ledger: readonly ConsentEntry[];
  readonly tombstonedAt: Date | null;
}

export interface RetrievalQuery {
  readonly actor: Actor;
  /** The RBAC resource being read. The caller declares this, the same way it already
   * would for any non-Brain read — this pipeline does not invent a mapping from a Brain
   * entity type to an RBAC resource type. */
  readonly resource: Resource;
  readonly purpose: Purpose;
  readonly subject: RetrievalSubject | null;
  /** Which entity types to search. Null searches all of them — see
   * `retrieval-intent-router.ts` for why this is caller-declared rather than classified. */
  readonly entityTypeHints: readonly BrainEntityType[] | null;
  /** A pre-computed query embedding. Null skips the vector top-k stage entirely — see
   * `retrieval-intent-router.ts`. */
  readonly queryEmbedding: readonly number[] | null;
  readonly vectorK: number;
  readonly graphHops: number;
  /** Null skips the episodic filter stage entirely. */
  readonly episodicWindow: { readonly from: Date; readonly to: Date } | null;
  readonly episodicSubjectNodeId: string | null;
  readonly tokenBudget: number;
  readonly now: Date;
}

export type RetrievalCandidateSource = 'vector' | 'graph';

export interface NodeRetrievalCandidate {
  readonly kind: 'node';
  readonly id: string;
  readonly entityType: BrainEntityType;
  readonly label: string;
  readonly attributes: unknown;
  readonly confidence: number;
  readonly recency: Date;
  readonly source: RetrievalCandidateSource;
  readonly vectorDistance: number | null;
  readonly graphHops: number | null;
}

export interface EpisodeRetrievalCandidate {
  readonly kind: 'episode';
  readonly id: string;
  readonly eventType: string;
  readonly summary: string;
  readonly detail: unknown;
  readonly confidence: number;
  /** `occurredAt` — when it happened, not when the system learned of it. */
  readonly recency: Date;
}

/** L0 Constitution — ratified policy, always assembled ahead of L1/L2/L3 (step 5). Has no
 * `confidence`: a ratified fact does not carry a probability the way an extracted one
 * does, and `recency` is `ratifiedAt`, not when a later reader happened to fetch it. */
export interface ConstitutionRetrievalCandidate {
  readonly kind: 'constitution';
  readonly id: string;
  readonly key: string;
  readonly constitutionKind: BrainConstitutionKind;
  readonly version: number;
  readonly content: unknown;
  readonly recency: Date;
}

/** L3 Procedural — an approved exemplar, assembled after L1/L2 (step 5). Same reasoning
 * as `ConstitutionRetrievalCandidate` for the absent `confidence`. */
export interface ExemplarRetrievalCandidate {
  readonly kind: 'exemplar';
  readonly id: string;
  readonly ref: string;
  readonly version: number;
  readonly content: unknown;
  readonly recency: Date;
}

export type RetrievalCandidate =
  | NodeRetrievalCandidate
  | EpisodeRetrievalCandidate
  | ConstitutionRetrievalCandidate
  | ExemplarRetrievalCandidate;

/** The two kinds `rerank` scores — the ones with a `confidence` an extraction actually
 * produced. Constitution and exemplar candidates skip rerank entirely: step 5's packer
 * places them by tier, not by this score (see `retrieval-assembly.ts`'s own header). */
export type RankableCandidate = NodeRetrievalCandidate | EpisodeRetrievalCandidate;
