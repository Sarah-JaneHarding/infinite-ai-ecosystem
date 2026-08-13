import { describe, expect, it } from 'vitest';
import {
  CAPS_ISIZULU_FAL_GR13_METADATA,
  CAPS_ISIZULU_FAL_GR13_SKILLS,
  CAPS_ISIZULU_FAL_GR13_DOC_ID,
  CAPS_ISIZULU_FAL_GR13_VERSION,
  IsiZuluFALSkillId,
  EXPECTED_FAL_WEEKLY_HOURS,
  FALSkillWeeklyAllocation,
} from '../src/curriculum/sources/caps-isizulu-fal-gr1-3.js';

describe('CAPS IsiZulu First Additional Language Grades 1-3 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.documentId).toBe(
        CAPS_ISIZULU_FAL_GR13_DOC_ID,
      );
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.documentVersion).toBe(
        CAPS_ISIZULU_FAL_GR13_VERSION,
      );
    });

    it('is marked RATIFIED and not yet countersigned into L0', () => {
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.status).toBe('RATIFIED');
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.ratifiedBy).toBeNull();
    });

    it('covers Foundation Phase Grades 1-3 only (FAL does not apply to Grade R)', () => {
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.phase).toBe('FOUNDATION');
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.grades).toStrictEqual(['1', '2', '3']);
      expect(CAPS_ISIZULU_FAL_GR13_METADATA.grades).not.toContain('R');
    });
  });

  describe('skill list', () => {
    it('contains exactly four skill components', () => {
      expect(CAPS_ISIZULU_FAL_GR13_SKILLS).toHaveLength(4);
    });

    it('every skill validates against the FALSkillWeeklyAllocation schema', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        const result = FALSkillWeeklyAllocation.safeParse(skill);
        expect(
          result.success,
          `skill ${skill.skillId} failed: ${JSON.stringify('error' in result ? result.error.issues : [])}`,
        ).toBe(true);
      }
    });

    it('skill ids are all valid IsiZuluFALSkillId values', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        expect(IsiZuluFALSkillId.safeParse(skill.skillId).success).toBe(true);
      }
    });

    it('skill ids are unique', () => {
      const ids = CAPS_ISIZULU_FAL_GR13_SKILLS.map((s) => s.skillId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every skill has a non-empty Zulu name', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        expect(skill.zuluName.length).toBeGreaterThan(0);
      }
    });
  });

  describe('time allocation — grade totals', () => {
    function sumForGrade(key: keyof typeof EXPECTED_FAL_WEEKLY_HOURS): number {
      return CAPS_ISIZULU_FAL_GR13_SKILLS.reduce(
        (acc, s) => acc + s.weeklyHoursMin[key],
        0,
      );
    }

    it('Grade 1 skills sum to 2h/week (minimum timetable)', () => {
      expect(sumForGrade('grade1')).toBeCloseTo(EXPECTED_FAL_WEEKLY_HOURS.grade1);
    });

    it('Grade 2 skills sum to 2h/week (minimum timetable)', () => {
      expect(sumForGrade('grade2')).toBeCloseTo(EXPECTED_FAL_WEEKLY_HOURS.grade2);
    });

    it('Grade 3 skills sum to 3h/week (minimum timetable)', () => {
      expect(sumForGrade('grade3')).toBeCloseTo(EXPECTED_FAL_WEEKLY_HOURS.grade3);
    });
  });

  describe('source provenance — every skill', () => {
    it('every source ref cites the correct document id', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        expect(skill.source.documentId).toBe(CAPS_ISIZULU_FAL_GR13_DOC_ID);
      }
    });

    it('every source ref is unratified (ratifiedBy is null)', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        expect(skill.source.ratifiedBy).toBeNull();
      }
    });

    it('every source ref cites a page number', () => {
      for (const skill of CAPS_ISIZULU_FAL_GR13_SKILLS) {
        expect(skill.source.page).toBeGreaterThan(0);
      }
    });
  });

  describe('failure paths', () => {
    it('rejects a skill with a negative weeklyHoursMin value', () => {
      const invalid = {
        ...CAPS_ISIZULU_FAL_GR13_SKILLS[0],
        weeklyHoursMin: { grade1: -1, grade2: 0.75, grade3: 1 },
      };
      expect(FALSkillWeeklyAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a skill with an unknown skillId', () => {
      const invalid = { ...CAPS_ISIZULU_FAL_GR13_SKILLS[0], skillId: 'not-a-real-skill' };
      expect(FALSkillWeeklyAllocation.safeParse(invalid).success).toBe(false);
    });

    it('accepts zero weeklyHoursMin (language-use is not separately allocated in Grades 1-2)', () => {
      const valid = {
        ...CAPS_ISIZULU_FAL_GR13_SKILLS[0],
        weeklyHoursMin: { grade1: 0, grade2: 0, grade3: 0.5 },
      };
      expect(FALSkillWeeklyAllocation.safeParse(valid).success).toBe(true);
    });
  });
});
