import { describe, expect, it } from 'vitest';

import { routeIntent } from '../src/retrieval-intent-router.js';
import type { RetrievalQuery } from '../src/retrieval-types.js';

const BASE_QUERY: RetrievalQuery = {
  actor: {
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    grants: [],
    guardianOfLearnerIds: [],
    impersonating: false,
  },
  resource: {
    type: 'learner',
    tenantId: '22222222-2222-4222-8222-222222222222',
    schoolId: null,
    classGroupId: null,
    subjectId: null,
    learnerId: null,
    ownerId: null,
  },
  purpose: 'planning',
  subject: null,
  entityTypeHints: null,
  queryEmbedding: null,
  vectorK: 5,
  graphHops: 0,
  episodicWindow: null,
  episodicSubjectNodeId: null,
  tokenBudget: 1000,
  now: new Date('2026-08-05T00:00:00.000Z'),
};

describe('routeIntent', () => {
  it('searches every entity type when no hint is given', () => {
    expect(routeIntent(BASE_QUERY).entityTypes).toBeNull();
  });

  it('carries an explicit entity type hint through unchanged', () => {
    const plan = routeIntent({ ...BASE_QUERY, entityTypeHints: ['LEARNER', 'TOPIC'] });
    expect(plan.entityTypes).toEqual(['LEARNER', 'TOPIC']);
  });

  it('skips vector search when no query embedding is supplied', () => {
    expect(routeIntent(BASE_QUERY).runVectorSearch).toBe(false);
  });

  it('runs vector search when a query embedding is supplied', () => {
    const plan = routeIntent({ ...BASE_QUERY, queryEmbedding: [0.1, 0.2] });
    expect(plan.runVectorSearch).toBe(true);
  });

  it('skips graph expansion when graphHops is 0', () => {
    expect(routeIntent(BASE_QUERY).runGraphExpansion).toBe(false);
  });

  it('runs graph expansion when graphHops is positive', () => {
    expect(routeIntent({ ...BASE_QUERY, graphHops: 2 }).runGraphExpansion).toBe(true);
  });

  it('skips the episodic filter when no window is supplied', () => {
    expect(routeIntent(BASE_QUERY).runEpisodicFilter).toBe(false);
  });

  it('runs the episodic filter when a window is supplied', () => {
    const plan = routeIntent({
      ...BASE_QUERY,
      episodicWindow: { from: new Date('2026-01-01'), to: new Date('2026-06-01') },
    });
    expect(plan.runEpisodicFilter).toBe(true);
  });
});
