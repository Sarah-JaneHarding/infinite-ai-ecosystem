// selectTemplateDefinitions — the pure read half of Stage 08 step 1's L0 wiring.
// submitTemplateDefinition needs a real TenantClient; it is proven in
// curriculum-templates.integration.spec.ts, the same split write-path.spec.ts and
// write-path.integration.spec.ts already use for the rest of this package.

import { describe, expect, it } from 'vitest';

import {
  CurriculumTemplateError,
  selectTemplateDefinitions,
} from '../src/curriculum-templates.js';
import type { RetrievalCandidate } from '../src/retrieval-types.js';

const source = {
  documentId: 'school-lesson-plan-template',
  documentVersion: '2026-term1',
  clause: 'as supplied',
  ratifiedBy: 'hod-1',
};

function templateCandidate(
  key: string,
  artefactType: string,
  overrides: Record<string, unknown> = {},
): RetrievalCandidate {
  return {
    kind: 'constitution',
    id: `constitution-${key}`,
    key,
    constitutionKind: 'TEMPLATE',
    version: 1,
    recency: new Date('2026-05-01T00:00:00.000Z'),
    content: {
      artefactType,
      version: '1.0.0',
      source,
      sections: [
        {
          name: 'Header',
          order: 0,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
      ],
      ratifiedAt: '2026-05-01T00:00:00.000Z',
      ...overrides,
    },
  };
}

describe('selectTemplateDefinitions', () => {
  it('returns every TEMPLATE constitution candidate, parsed', () => {
    const candidates: readonly RetrievalCandidate[] = [
      templateCandidate('LESSON_PLAN', 'LESSON_PLAN'),
      templateCandidate('UNIT_PLAN', 'UNIT_PLAN'),
    ];
    const definitions = selectTemplateDefinitions(candidates);
    expect(definitions.map((d) => d.artefactType).toSorted()).toEqual([
      'LESSON_PLAN',
      'UNIT_PLAN',
    ]);
  });

  it('narrows to one artefact type when asked', () => {
    const candidates: readonly RetrievalCandidate[] = [
      templateCandidate('LESSON_PLAN', 'LESSON_PLAN'),
      templateCandidate('UNIT_PLAN', 'UNIT_PLAN'),
    ];
    const definitions = selectTemplateDefinitions(candidates, 'UNIT_PLAN');
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.artefactType).toBe('UNIT_PLAN');
  });

  it('ignores non-TEMPLATE constitution candidates and non-constitution candidates', () => {
    const candidates: readonly RetrievalCandidate[] = [
      templateCandidate('LESSON_PLAN', 'LESSON_PLAN'),
      {
        kind: 'constitution',
        id: 'other',
        key: 'assessment-policy',
        constitutionKind: 'ASSESSMENT_POLICY',
        version: 1,
        content: { anything: true },
        recency: new Date(),
      },
      {
        kind: 'node',
        id: 'node-1',
        entityType: 'TOPIC',
        label: 'Fractions',
        attributes: {},
        confidence: 1,
        recency: new Date(),
        source: 'vector',
        vectorDistance: null,
        graphHops: null,
      },
    ];
    const definitions = selectTemplateDefinitions(candidates);
    expect(definitions).toHaveLength(1);
  });

  it('returns an empty list when nothing is ratified yet', () => {
    expect(selectTemplateDefinitions([])).toEqual([]);
  });

  it('throws for a TEMPLATE row whose content does not parse as a TemplateDefinition', () => {
    const candidates: readonly RetrievalCandidate[] = [
      templateCandidate('LESSON_PLAN', 'LESSON_PLAN', { sections: [] }),
    ];
    expect(() => selectTemplateDefinitions(candidates)).toThrow(CurriculumTemplateError);
  });
});
