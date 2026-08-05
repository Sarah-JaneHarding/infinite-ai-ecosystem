// The retrieval path's data-touching stages — Stage 05 step 4.
//
// `query → intent router → policy + RBAC + purpose gate → vector top-k → graph n-hop
// expansion → episodic temporal filter → rerank → token-budgeted context assembly`. The
// first two stages and the last two are pure and live in `packages/brain`; the three in
// the middle need a real Postgres, so they live here — the same split the write path
// draws between this package (persistence) and `packages/brain` (orchestration and
// decisions).
//
// Corrects a note from step 1: `BrainEmbedding`'s own schema comment said raw SQL for the
// vector column would live in `packages/brain`, because at the time nothing had decided
// the retrieval path's actual architecture. Keeping every Brain table's access inside
// `packages/db` — the shape the write path settled on — is worth more than honouring an
// early guess; the schema comment is updated in the same commit as this file.

import { Prisma, type BrainEntityType } from '@prisma/client';

import type { TenantClient } from './client.js';

export class BrainRetrievalError extends Error {
  public override readonly name = 'BrainRetrievalError';
  constructor(message: string) {
    super(message);
  }
}

export interface NodeCandidateRow {
  readonly id: string;
  readonly entityType: BrainEntityType;
  readonly externalRef: string | null;
  readonly label: string;
  readonly attributes: unknown;
  readonly confidence: number;
  readonly createdAt: Date;
}

export interface EdgeRow {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: string;
}

export interface EpisodeCandidateRow {
  readonly id: string;
  readonly eventType: string;
  readonly subjectNodeId: string | null;
  readonly summary: string;
  readonly detail: unknown;
  readonly occurredAt: Date;
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// Vector top-k
// ---------------------------------------------------------------------------

export interface VectorTopKQuery {
  readonly queryEmbedding: readonly number[];
  /** Null searches every entity type. */
  readonly entityTypes: readonly BrainEntityType[] | null;
  readonly k: number;
}

export interface VectorTopKMatch {
  readonly node: NodeCandidateRow;
  /** Cosine distance — pgvector's `<=>`. Lower is more similar. */
  readonly distance: number;
}

/**
 * The one raw-SQL query in this module. `Prisma.InputJsonValue`'s cousin problem: Prisma
 * has no vector type at all, so `embedding` is invisible to the generated client and
 * every comparison against it has to be hand-written.
 *
 * Only effective nodes are searched — not tombstoned, and nothing else supersedes them —
 * the same "effective" `findEffectiveBrainFact` (`brain-write-path.ts`) already uses for
 * the write path's natural-key lookups.
 */
export async function vectorTopK(
  tx: TenantClient,
  query: VectorTopKQuery,
): Promise<readonly VectorTopKMatch[]> {
  if (query.queryEmbedding.length === 0) {
    throw new BrainRetrievalError(
      'Refusing a vector search with an empty query embedding.',
    );
  }
  for (const value of query.queryEmbedding) {
    if (!Number.isFinite(value)) {
      throw new BrainRetrievalError(
        'Refusing a vector search with a non-finite embedding component.',
      );
    }
  }
  if (query.k < 1) {
    throw new BrainRetrievalError('Refusing a vector search with k < 1.');
  }

  // Every element was just checked finite above, so this is a list of digits, decimal
  // points and minus signs — never caller-controlled text — which is what makes building
  // the literal this way safe. pgvector's own wire format has no parameterised form Prisma
  // can bind to, so there is no parameterised alternative to fall back to here.
  const vectorLiteral = `[${query.queryEmbedding.join(',')}]`;

  const entityFilter =
    query.entityTypes === null
      ? Prisma.empty
      : Prisma.sql`AND n.entity_type IN (${Prisma.join(query.entityTypes)})`;

  const rows = await tx.$queryRaw<
    {
      id: string;
      entity_type: BrainEntityType;
      external_ref: string | null;
      label: string;
      attributes: unknown;
      confidence: number;
      created_at: Date;
      distance: number;
    }[]
  >(Prisma.sql`
    SELECT n.id, n.entity_type, n.external_ref, n.label, n.attributes, n.confidence, n.created_at,
           e.embedding <=> ${vectorLiteral}::vector AS distance
    FROM "brain_embedding" e
    JOIN "brain_node" n ON n.id = e.node_id
    WHERE n.tombstoned_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM "brain_node" n2 WHERE n2.supersedes = n.id)
      ${entityFilter}
    ORDER BY distance ASC
    LIMIT ${query.k}
  `);

  return rows.map((row) => ({
    node: {
      id: row.id,
      entityType: row.entity_type,
      externalRef: row.external_ref,
      label: row.label,
      attributes: row.attributes,
      confidence: row.confidence,
      createdAt: row.created_at,
    },
    distance: row.distance,
  }));
}

// ---------------------------------------------------------------------------
// Graph n-hop expansion
// ---------------------------------------------------------------------------

export interface ExpandedNode extends NodeCandidateRow {
  /** How many edges from the seed set this node was first reached at. */
  readonly hops: number;
}

export interface GraphExpansionResult {
  /** Newly discovered nodes only — the seeds themselves are the caller's already. */
  readonly nodes: readonly ExpandedNode[];
  readonly edges: readonly EdgeRow[];
}

/**
 * Breadth-first expansion from `seedNodeIds` out to `hops` edges, over
 * non-tombstoned edges in either direction. One `findMany` per hop, not per node —
 * `hops` is expected to be small (2-3), so this is a handful of queries, not a fan-out.
 */
export async function expandGraph(
  tx: TenantClient,
  seedNodeIds: readonly string[],
  hops: number,
): Promise<GraphExpansionResult> {
  if (hops < 0) {
    throw new BrainRetrievalError('Refusing a negative hop count.');
  }
  if (seedNodeIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const visited = new Set<string>(seedNodeIds);
  const hopOf = new Map<string, number>();
  const collectedEdges: EdgeRow[] = [];
  let frontier: readonly string[] = seedNodeIds;

  for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
    const edges = await tx.brainEdge.findMany({
      where: {
        OR: [{ sourceId: { in: [...frontier] } }, { targetId: { in: [...frontier] } }],
        tombstonedAt: null,
      },
      select: { id: true, sourceId: true, targetId: true, relation: true },
    });
    collectedEdges.push(...edges);

    const nextFrontier: string[] = [];
    for (const edge of edges) {
      for (const candidateId of [edge.sourceId, edge.targetId]) {
        if (!visited.has(candidateId)) {
          visited.add(candidateId);
          hopOf.set(candidateId, hop + 1);
          nextFrontier.push(candidateId);
        }
      }
    }
    frontier = nextFrontier;
  }

  const discoveredIds = [...visited].filter((id) => !seedNodeIds.includes(id));
  const rows =
    discoveredIds.length === 0
      ? []
      : await tx.brainNode.findMany({
          where: { id: { in: discoveredIds }, tombstonedAt: null },
          select: {
            id: true,
            entityType: true,
            externalRef: true,
            label: true,
            attributes: true,
            confidence: true,
            createdAt: true,
          },
        });
  // hopOf is guaranteed to have an entry for every id in discoveredIds — that set is
  // exactly hopOf's own keys minus the seeds, which discoveredIds is filtered from.
  const nodes = rows.map((row) => ({ ...row, hops: hopOf.get(row.id)! }));

  return { nodes, edges: collectedEdges };
}

// ---------------------------------------------------------------------------
// Episodic temporal filter
// ---------------------------------------------------------------------------

export interface EpisodicWindow {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Episodes within `window`, optionally narrowed to one subject node — the "what did we
 * decide about X in Term 2 last year" query this stage exists for, filtering on
 * `occurredAt` (when it happened), not `recordedAt` (when the system learned of it).
 */
export async function filterEpisodesByWindow(
  tx: TenantClient,
  subjectNodeId: string | null,
  window: EpisodicWindow,
): Promise<readonly EpisodeCandidateRow[]> {
  if (window.from.getTime() > window.to.getTime()) {
    throw new BrainRetrievalError(
      'Refusing an episodic window whose start is after its end.',
    );
  }
  const rows = await tx.brainEpisode.findMany({
    where: {
      occurredAt: { gte: window.from, lte: window.to },
      ...(subjectNodeId === null ? {} : { subjectNodeId }),
    },
    orderBy: { occurredAt: 'asc' },
    select: {
      id: true,
      eventType: true,
      subjectNodeId: true,
      summary: true,
      detail: true,
      occurredAt: true,
      confidence: true,
    },
  });
  return rows;
}
