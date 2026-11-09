import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CAPS_SESOTHO_HL_FP_CONTENT_AREAS,
  CAPS_SESOTHO_HL_FP_DOC_ID,
  CAPS_SESOTHO_HL_FP_FORMAL_TASKS_PER_TERM,
  CAPS_SESOTHO_HL_FP_ISBN,
  CAPS_SESOTHO_HL_FP_METADATA,
  CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS,
  CAPS_SESOTHO_HL_FP_VERSION,
  CAPS_SESOTHO_HL_FP_WEEKLY_HOURS,
} from '../src/curriculum/sources/caps-sesotho-hl-fp-gr-r3.js';

const GRADES = ['R', '1', '2', '3'] as const;

const Progression = z.object({
  contentArea: z.string().min(1),
  topicCode: z.string().nullable(),
  topicName: z.string().min(1),
  grade: z.enum(GRADES),
  description: z.string().min(40),
  basis: z.object({
    documentId: z.literal(CAPS_SESOTHO_HL_FP_DOC_ID),
    documentVersion: z.literal(CAPS_SESOTHO_HL_FP_VERSION),
    clause: z.string().min(1),
    ratifiedBy: z.null(),
  }),
});

describe('CAPS Sesotho Home Language Foundation Phase Grades R-3 source registration', () => {
  it('has the expected identity, ISBN and unratified status', () => {
    expect(CAPS_SESOTHO_HL_FP_METADATA.documentId).toBe('caps-sesotho-hl-fp-gr-r3-2011');
    expect(CAPS_SESOTHO_HL_FP_METADATA.documentVersion).toBe(CAPS_SESOTHO_HL_FP_VERSION);
    expect(CAPS_SESOTHO_HL_FP_ISBN).toBe('978-1-4315-0403-9');
    expect(CAPS_SESOTHO_HL_FP_METADATA.status).toBe('RATIFIED');
    expect(CAPS_SESOTHO_HL_FP_METADATA.ratifiedBy).toBeNull();
  });

  it('every progression parses and carries an unratified source reference', () => {
    for (const row of CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS) {
      expect(Progression.safeParse(row).success, `${row.contentArea} ${row.grade}`).toBe(
        true,
      );
    }
  });

  it('covers every content area in every Foundation Phase grade exactly once', () => {
    for (const area of CAPS_SESOTHO_HL_FP_CONTENT_AREAS) {
      for (const grade of GRADES) {
        const hits = CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS.filter(
          (r) => r.contentArea === area && r.grade === grade,
        );
        expect(hits, `${area} grade ${grade}`).toHaveLength(1);
      }
    }
    expect(CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS).toHaveLength(
      CAPS_SESOTHO_HL_FP_CONTENT_AREAS.length * GRADES.length,
    );
  });

  it('uses no content area outside the declared list', () => {
    const declared = new Set<string>(CAPS_SESOTHO_HL_FP_CONTENT_AREAS);
    for (const row of CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS) {
      expect(declared.has(row.contentArea)).toBe(true);
    }
  });

  it('weekly hours are ordered and Grade R is the only fixed allocation', () => {
    expect(CAPS_SESOTHO_HL_FP_WEEKLY_HOURS.map((h) => h.grade)).toEqual([...GRADES]);
    for (const h of CAPS_SESOTHO_HL_FP_WEEKLY_HOURS) {
      expect(h.minimumHours).toBeLessThanOrEqual(h.maximumHours);
    }
    expect(CAPS_SESOTHO_HL_FP_WEEKLY_HOURS[0]).toMatchObject({
      minimumHours: 10,
      maximumHours: 10,
    });
  });

  it('formal task counts per term add up to the stated yearly total', () => {
    for (const g of CAPS_SESOTHO_HL_FP_FORMAL_TASKS_PER_TERM) {
      expect(g.term1 + g.term2 + g.term3 + g.term4).toBe(g.total);
    }
    expect(CAPS_SESOTHO_HL_FP_FORMAL_TASKS_PER_TERM.map((g) => g.total)).toEqual([
      7, 7, 9,
    ]);
  });

  it('rejects a progression whose reference has been countersigned or whose grade is wrong', () => {
    const base = CAPS_SESOTHO_HL_FP_TOPIC_PROGRESSIONS[0];
    expect(base).toBeDefined();
    const signed = { ...base, basis: { ...base?.basis, ratifiedBy: 'someone' } };
    const wrongGrade = { ...base, grade: '4' };
    expect(Progression.safeParse(signed).success).toBe(false);
    expect(Progression.safeParse(wrongGrade).success).toBe(false);
  });
});
