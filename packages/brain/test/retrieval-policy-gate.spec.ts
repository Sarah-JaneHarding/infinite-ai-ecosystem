import type { Actor, Resource } from '@infinite-ai/policy';
import { describe, expect, it } from 'vitest';

import { gateRetrieval } from '../src/retrieval-policy-gate.js';
import type { RetrievalSubject } from '../src/retrieval-types.js';

const TENANT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-05T00:00:00.000Z');

const teacher: Actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  tenantId: TENANT_ID,
  grants: [
    {
      role: 'teacher',
      schoolId: null,
      classGroupId: CLASS_ID,
      subjectId: null,
      expiresAt: null,
    },
  ],
  guardianOfLearnerIds: [],
  impersonating: false,
};

const ownClassLearnerResource: Resource = {
  type: 'learner',
  tenantId: TENANT_ID,
  schoolId: null,
  classGroupId: CLASS_ID,
  subjectId: null,
  learnerId: null,
  ownerId: null,
};

describe('gateRetrieval', () => {
  it('refuses when RBAC denies the resource outright', () => {
    // A teacher has no grant at all for tenant_setting.
    const decision = gateRetrieval(
      teacher,
      { ...ownClassLearnerResource, type: 'tenant_setting' },
      'planning',
      null,
      NOW,
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe('rbac_denied');
    expect(decision.rbac.allowed).toBe(false);
  });

  it('refuses when RBAC denies the resource by scope (another class)', () => {
    const otherClassResource: Resource = {
      ...ownClassLearnerResource,
      classGroupId: '44444444-4444-4444-8444-444444444444',
    };
    const decision = gateRetrieval(teacher, otherClassResource, 'planning', null, NOW);
    expect(decision.allowed).toBe(false);
  });

  it('allows with no access projection when the retrieval names no data subject', () => {
    const decision = gateRetrieval(
      teacher,
      ownClassLearnerResource,
      'planning',
      null,
      NOW,
    );
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('unreachable');
    expect(decision.access).toBeNull();
  });

  it('projects the purpose/consent gate when the retrieval names a subject', () => {
    const subject: RetrievalSubject = {
      subjectToken: 'LNR_ABC123',
      requestedCategories: ['ATTENDANCE', 'BEHAVIOUR'],
      ledger: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          tenantId: TENANT_ID,
          subjectToken: 'LNR_ABC123',
          category: 'ATTENDANCE',
          purpose: 'screening',
          basis: 'PUBLIC_LAW_DUTY',
          decision: 'GRANTED',
          source: 'NOT_APPLICABLE',
          evidenceRef: null,
          effectiveFrom: new Date('2026-01-01'),
          recordedAt: new Date('2026-01-01'),
          recordedBy: null,
          note: null,
        },
      ],
      tombstonedAt: null,
    };

    const decision = gateRetrieval(
      teacher,
      ownClassLearnerResource,
      'screening',
      subject,
      NOW,
    );
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('unreachable');
    expect(decision.access).not.toBeNull();
    expect(decision.access!.allowed).toEqual(['ATTENDANCE']);
    expect(decision.access!.dropped).toEqual([
      { category: 'BEHAVIOUR', reason: 'no_lawful_basis' },
    ]);
  });

  it('drops every category when the subject is tombstoned, even with RBAC allowed', () => {
    const subject: RetrievalSubject = {
      subjectToken: 'LNR_ABC123',
      requestedCategories: ['ATTENDANCE'],
      ledger: [],
      tombstonedAt: new Date('2026-02-01'),
    };
    const decision = gateRetrieval(
      teacher,
      ownClassLearnerResource,
      'screening',
      subject,
      NOW,
    );
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('unreachable');
    expect(decision.access!.allowed).toEqual([]);
    expect(decision.access!.dropped).toEqual([
      { category: 'ATTENDANCE', reason: 'subject_tombstoned' },
    ]);
  });
});
