// The retrieval path's orchestrator — Stage 05 step 4.
//
// `query → intent router → policy + RBAC + purpose gate → vector top-k → graph n-hop
// expansion → episodic temporal filter → rerank → token-budgeted context assembly`,
// exactly the manual's own order. `trace` records every stage as it runs, in the fixed
// order this function's own code calls them in — a reordered pipeline is a reordered
// `trace`, which is what `retrieval-path.spec.ts` asserts against directly. The policy
// gate is called immediately after intent routing and before anything that reads Brain
// data; a refusal returns with an empty `trace` tail (no `vector_searched` and onward,
// ever), which is "the policy gate runs before retrieval, never after" made structural
// rather than merely documented.

import {
  expandGraph,
  filterEpisodesByWindow,
  vectorTopK,
  type EpisodeCandidateRow,
  type ExpandedNode,
  type NodeCandidateRow,
  type TenantClient,
} from '@infinite-ai/db';
import { isEmpty } from '@infinite-ai/policy';
import { NOOP_TRACER, type Tracer } from '@infinite-ai/telemetry';

import { assembleContext, type AssembledContext } from './retrieval-assembly.js';
import { routeIntent } from './retrieval-intent-router.js';
import { gateRetrieval, type RetrievalPolicyDecision } from './retrieval-policy-gate.js';
import { rerank, type ScoredCandidate } from './retrieval-rerank.js';
import type {
  NodeRetrievalCandidate,
  RetrievalCandidate,
  RetrievalQuery,
} from './retrieval-types.js';

export const RETRIEVAL_PATH_ORDER = [
  'intent_routed',
  'policy_gated',
  'vector_searched',
  'graph_expanded',
  'episodes_filtered',
  'reranked',
  'assembled',
] as const;
export type RetrievalStage = (typeof RETRIEVAL_PATH_ORDER)[number];

export class RetrievalPathError extends Error {
  public override readonly name = 'RetrievalPathError';
  constructor(message: string) {
    super(message);
  }
}

export interface RetrievalResult {
  readonly trace: readonly RetrievalStage[];
  readonly policy: RetrievalPolicyDecision;
  readonly candidates: readonly RetrievalCandidate[];
  readonly ranked: readonly ScoredCandidate[];
  /** Null whenever the policy gate refused, or permitted no category at all. */
  readonly assembled: AssembledContext | null;
}

function toNodeCandidate(
  node: NodeCandidateRow | ExpandedNode,
  source: 'vector' | 'graph',
  vectorDistance: number | null,
): NodeRetrievalCandidate {
  return {
    kind: 'node',
    id: node.id,
    entityType: node.entityType,
    label: node.label,
    attributes: node.attributes,
    confidence: node.confidence,
    recency: node.createdAt,
    source,
    vectorDistance,
    graphHops: 'hops' in node ? node.hops : null,
  };
}

function toEpisodeCandidate(episode: EpisodeCandidateRow): RetrievalCandidate {
  return {
    kind: 'episode',
    id: episode.id,
    eventType: episode.eventType,
    summary: episode.summary,
    detail: episode.detail,
    confidence: episode.confidence,
    recency: episode.occurredAt,
  };
}

/** The empty result a refused or category-less retrieval returns. */
function refused(
  trace: readonly RetrievalStage[],
  policy: RetrievalPolicyDecision,
): RetrievalResult {
  return { trace, policy, candidates: [], ranked: [], assembled: null };
}

export async function retrieve(
  tx: TenantClient,
  query: RetrievalQuery,
  tracer: Tracer = NOOP_TRACER,
): Promise<RetrievalResult> {
  const span = tracer.startSpan('brain.retrieve');
  const trace: RetrievalStage[] = [];
  try {
    const plan = routeIntent(query);
    trace.push('intent_routed');
    span.addEvent('intent_routed', {
      entityTypes: plan.entityTypes === null ? 'all' : plan.entityTypes.join(','),
      runVectorSearch: plan.runVectorSearch,
      runGraphExpansion: plan.runGraphExpansion,
      runEpisodicFilter: plan.runEpisodicFilter,
    });

    const policy = gateRetrieval(
      query.actor,
      query.resource,
      query.purpose,
      query.subject,
      query.now,
    );
    trace.push('policy_gated');
    span.setAttribute('brain.retrieval.policy_allowed', policy.allowed);
    if (!policy.allowed) {
      span.addEvent('brain.retrieval.refused', { reason: policy.reason });
      return refused(trace, policy);
    }
    if (policy.access !== null && isEmpty(policy.access)) {
      span.addEvent('brain.retrieval.refused', { reason: 'no_permitted_category' });
      return refused(trace, policy);
    }
    // `policy.access.allowed`/`.dropped` name which requested `DataCategory` values may
    // flow at all — the boundary decision. They do not filter individual fields inside a
    // Brain node's free-form `attributes` or an episode's `detail`, because nothing in
    // this schema declares which category a given attribute belongs to (unlike the
    // Stage 03 tables, whose columns map to a category one-for-one). Attaching that
    // mapping is a later module's job, once one exists with attributes to classify.

    const candidates: RetrievalCandidate[] = [];

    if (plan.runVectorSearch) {
      const matches = await vectorTopK(tx, {
        queryEmbedding: query.queryEmbedding!,
        entityTypes: plan.entityTypes,
        k: query.vectorK,
      });
      candidates.push(
        ...matches.map((m) => toNodeCandidate(m.node, 'vector', m.distance)),
      );
      span.setAttribute('brain.retrieval.vector_matches', matches.length);
    }
    trace.push('vector_searched');

    if (plan.runGraphExpansion) {
      const seedIds = candidates
        .filter((c): c is NodeRetrievalCandidate => c.kind === 'node')
        .map((c) => c.id);
      if (seedIds.length > 0) {
        const expansion = await expandGraph(tx, seedIds, query.graphHops);
        candidates.push(...expansion.nodes.map((n) => toNodeCandidate(n, 'graph', null)));
        span.setAttribute('brain.retrieval.graph_expanded_nodes', expansion.nodes.length);
      }
    }
    trace.push('graph_expanded');

    if (plan.runEpisodicFilter) {
      const episodes = await filterEpisodesByWindow(
        tx,
        query.episodicSubjectNodeId,
        query.episodicWindow!,
      );
      candidates.push(...episodes.map(toEpisodeCandidate));
      span.setAttribute('brain.retrieval.episodes_found', episodes.length);
    }
    trace.push('episodes_filtered');

    const ranked = rerank(candidates, query.now);
    trace.push('reranked');

    const assembled = assembleContext(ranked, query.tokenBudget);
    trace.push('assembled');
    span.setAttribute('brain.retrieval.assembled_count', assembled.included.length);
    span.setAttribute('brain.retrieval.dropped_count', assembled.dropped.length);
    span.setAttribute('brain.retrieval.total_tokens', assembled.totalTokens);

    return { trace, policy, candidates, ranked, assembled };
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
