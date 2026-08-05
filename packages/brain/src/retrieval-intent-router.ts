// The intent router — Stage 05 step 4, first stage.
//
// Real intent classification — "this query is about a learner's reading progress" from
// free text alone — needs either a trained classifier or a model call. A model call would
// have to go through the Model Gateway (rule 3), which means a real caller with its own
// prompt version, eval set and cost budget (rule 9's checklist for a new agent) — Stage
// 06's agent runtime, not this one. Building a first, uncalibrated path to a model here,
// before that caller exists, is exactly what rule 9 exists to stop.
//
// So this stage is deliberately mechanical: it reads what the caller already declared
// (`entityTypeHints`, whether it supplied a query embedding, whether it named a time
// window) and turns that into a plan. Nothing here infers intent from the query text —
// there is no query text parameter at all, on purpose.

import type { RetrievalQuery } from './retrieval-types.js';
import type { BrainEntityType } from './write-path-schemas.js';

export interface RetrievalPlan {
  /** Null searches every entity type. */
  readonly entityTypes: readonly BrainEntityType[] | null;
  readonly runVectorSearch: boolean;
  readonly runGraphExpansion: boolean;
  readonly runEpisodicFilter: boolean;
}

export function routeIntent(query: RetrievalQuery): RetrievalPlan {
  return {
    entityTypes: query.entityTypeHints,
    runVectorSearch: query.queryEmbedding !== null,
    runGraphExpansion: query.graphHops > 0,
    runEpisodicFilter: query.episodicWindow !== null,
  };
}
