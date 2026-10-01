import { describe, it, expect } from 'vitest';

import {
  buildCatalogue,
  buildCurriculumMap,
  compareGrades,
  formatWeeks,
  gradeLabel,
  parseAtpDocuments,
  resolveSelection,
  selectCurriculum,
  type ConstitutionRowInput,
} from '../../src/lib/atp-curriculum.js';

// Shaped like the rows `pnpm curriculum:seed` / `:ratify` really write to L0
// (`brain_constitution`, kind ATP_CALENDAR) — checked against the running database.
function atpRow(over: Record<string, unknown> = {}): ConstitutionRowInput {
  return {
    kind: 'ATP_CALENDAR',
    content: {
      grade: '6',
      phase: 'Intermediate',
      subject: 'Mathematics',
      atpYear: 2023,
      documentId: 'G6-MATHS-2023',
      sourceDescription: 'Grade 6 Mathematics — DBE 2023',
      source: { documentVersion: '2023', clause: 'ATP source document' },
      topics: [
        {
          term: 2,
          topic: 'Fractions',
          weekStart: 3,
          weekEnd: 5,
          contentArea: 'Numbers',
          assessmentType: null,
        },
        {
          term: 1,
          topic: 'Whole numbers',
          weekStart: 1,
          weekEnd: 1,
          contentArea: 'Numbers',
          assessmentType: 'Test',
        },
      ],
      fats: [{ term: 1, fatNumber: 1, fatType: 'Test', fatDescription: 'T1 test' }],
      ...over,
    },
  };
}

describe('parseAtpDocuments', () => {
  it('parses a stored ATP row into typed topics, assessment tasks and a source reference', () => {
    const { documents, skipped } = parseAtpDocuments([atpRow()]);

    expect(skipped).toBe(0);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      grade: '6',
      subject: 'Mathematics',
      atpYear: 2023,
      source: {
        documentId: 'G6-MATHS-2023',
        documentVersion: '2023',
        description: 'Grade 6 Mathematics — DBE 2023',
      },
    });
    expect(documents[0]?.topics).toHaveLength(2);
    expect(documents[0]?.fats[0]).toEqual({
      term: 1,
      fatNumber: 1,
      fatType: 'Test',
      fatDescription: 'T1 test',
    });
  });

  it('exposes only what the ATP holds — no lesson-level fields are ever invented', () => {
    const topic = parseAtpDocuments([atpRow()]).documents[0]?.topics[0];

    expect(Object.keys(topic ?? {}).sort()).toEqual([
      'assessmentType',
      'contentArea',
      'term',
      'topic',
      'weekEnd',
      'weekStart',
    ]);
  });

  it('ignores constitution rows of other kinds', () => {
    const { documents, skipped } = parseAtpDocuments([
      { kind: 'CAPS_CANON', content: { anything: true } },
      { kind: 'TEMPLATE', content: null },
      atpRow(),
    ]);

    expect(documents).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it('skips and counts an ATP row that does not match the stored shape, instead of rendering it half-understood', () => {
    const { documents, skipped } = parseAtpDocuments([
      atpRow(),
      { kind: 'ATP_CALENDAR', content: 'not an object' },
      { kind: 'ATP_CALENDAR', content: null },
      atpRow({ topics: 'nope' }),
      atpRow({
        topics: [
          { term: 5, topic: 'Bad term', weekStart: 1, weekEnd: 1, contentArea: 'x' },
        ],
      }),
      atpRow({
        topics: [{ term: 1, topic: '', weekStart: 1, weekEnd: 1, contentArea: 'x' }],
      }),
      atpRow({
        topics: [{ term: 1, topic: 'Neg', weekStart: -1, weekEnd: 1, contentArea: 'x' }],
      }),
      atpRow({ grade: '' }),
    ]);

    expect(documents).toHaveLength(1);
    expect(skipped).toBe(7);
  });

  it('treats a missing assessmentType and missing fats as "none", not as an error', () => {
    const row = atpRow();
    const content = row.content as { topics: Record<string, unknown>[]; fats?: unknown };
    delete content.fats;
    content.topics = [
      { term: 3, topic: 'Geometry', weekStart: 1, weekEnd: 2, contentArea: 'Space' },
    ];

    const { documents, skipped } = parseAtpDocuments([row]);

    expect(skipped).toBe(0);
    expect(documents[0]?.topics[0]?.assessmentType).toBeNull();
    expect(documents[0]?.fats).toEqual([]);
  });
});

describe('grades', () => {
  it('orders Grade R first, then numerically, then multi-grade documents after their first grade', () => {
    expect(['7', '4-6', '10', 'R', '1', '4', '5'].sort(compareGrades)).toEqual([
      'R',
      '1',
      '4',
      '4-6',
      '5',
      '7',
      '10',
    ]);
  });

  it('labels grades for people', () => {
    expect(gradeLabel('R')).toBe('Grade R');
    expect(gradeLabel('6')).toBe('Grade 6');
    expect(gradeLabel('4-6')).toBe('Grades 4–6');
  });
});

describe('catalogue and selection', () => {
  const docs = parseAtpDocuments([
    atpRow(),
    atpRow({ subject: 'Home Language', documentId: 'G6-HL' }),
    atpRow({ grade: '1', subject: 'Life Skills', documentId: 'G1-LS' }),
  ]).documents;

  it("lists grades in order and each grade's subjects alphabetically", () => {
    const catalogue = buildCatalogue(docs);

    expect(catalogue.grades).toEqual(['1', '6']);
    expect(catalogue.subjectsByGrade['6']).toEqual(['Home Language', 'Mathematics']);
    expect(catalogue.subjectsByGrade['1']).toEqual(['Life Skills']);
  });

  it('keeps a valid request as asked', () => {
    expect(resolveSelection(buildCatalogue(docs), '6', 'Mathematics')).toEqual({
      grade: '6',
      subject: 'Mathematics',
    });
  });

  it('falls back to the first available grade and subject when nothing is requested', () => {
    expect(resolveSelection(buildCatalogue(docs), undefined, undefined)).toEqual({
      grade: '1',
      subject: 'Life Skills',
    });
  });

  it('never echoes an unknown grade or subject back — untrusted input falls back to a real choice', () => {
    const catalogue = buildCatalogue(docs);

    expect(resolveSelection(catalogue, '<script>alert(1)</script>', 'x')).toEqual({
      grade: '1',
      subject: 'Life Skills',
    });
    expect(resolveSelection(catalogue, '6', 'Life Skills')).toEqual({
      grade: '6',
      subject: 'Home Language',
    });
  });

  it('returns null when there is no curriculum data at all', () => {
    expect(resolveSelection(buildCatalogue([]), '6', 'Mathematics')).toBeNull();
  });
});

describe('selectCurriculum', () => {
  it('keeps plans from different ATP years apart and does not choose between them', () => {
    const docs = parseAtpDocuments([
      atpRow({ atpYear: 2026, documentId: 'G6-MATHS-2026' }),
      atpRow({ atpYear: 2023, documentId: 'G6-MATHS-2023' }),
    ]).documents;

    const groups = selectCurriculum(docs, '6', 'Mathematics');

    expect(groups.map((g) => g.atpYear)).toEqual([2023, 2026]);
    expect(groups[0]?.sources.map((s) => s.documentId)).toEqual(['G6-MATHS-2023']);
    expect(groups[1]?.sources.map((s) => s.documentId)).toEqual(['G6-MATHS-2026']);
  });

  it('merges several documents of the same year and orders topics by term then week', () => {
    const docs = parseAtpDocuments([
      atpRow({ documentId: 'A' }),
      atpRow({
        documentId: 'B',
        topics: [
          { term: 1, topic: 'Early', weekStart: 0 + 1, weekEnd: 1, contentArea: 'x' },
        ],
      }),
    ]).documents;

    const [group] = selectCurriculum(docs, '6', 'Mathematics');

    expect(group?.sources).toHaveLength(2);
    expect(group?.topics.map((t) => `${t.term}:${t.weekStart}`)).toEqual([
      '1:1',
      '1:1',
      '2:3',
    ]);
  });

  it('returns nothing for a grade and subject that has no plan, and never mixes in another subject', () => {
    const docs = parseAtpDocuments([atpRow()]).documents;

    expect(selectCurriculum(docs, '6', 'Life Skills')).toEqual([]);
    expect(selectCurriculum(docs, '7', 'Mathematics')).toEqual([]);
  });
});

describe('formatWeeks', () => {
  it('shows a single week as a number and a span as a range', () => {
    expect(formatWeeks({ weekStart: 4, weekEnd: 4 })).toBe('4');
    expect(formatWeeks({ weekStart: 1, weekEnd: 10 })).toBe('1–10');
  });
});

describe('buildCurriculumMap', () => {
  it('assembles the catalogue, the selection, its groups and the skipped count', () => {
    const data = buildCurriculumMap(
      [atpRow(), { kind: 'ATP_CALENDAR', content: 42 }],
      '6',
      'Mathematics',
    );

    expect(data.skipped).toBe(1);
    expect(data.selection).toEqual({ grade: '6', subject: 'Mathematics' });
    expect(data.groups).toHaveLength(1);
    expect(data.catalogue.grades).toEqual(['6']);
  });

  it('is an empty, honest state when the school has no ATP data', () => {
    const data = buildCurriculumMap([], undefined, undefined);

    expect(data.selection).toBeNull();
    expect(data.groups).toEqual([]);
    expect(data.catalogue.grades).toEqual([]);
  });
});
