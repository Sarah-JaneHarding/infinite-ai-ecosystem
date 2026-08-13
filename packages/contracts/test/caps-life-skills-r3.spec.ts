import { describe, expect, it } from 'vitest';
import {
  CAPS_LIFE_SKILLS_R3_METADATA,
  CAPS_LIFE_SKILLS_R3_STUDY_AREAS,
  CAPS_LIFE_SKILLS_R3_DOC_ID,
  CAPS_LIFE_SKILLS_R3_VERSION,
  LifeSkillsStudyAreaId,
  EXPECTED_LIFE_SKILLS_TERM_HOURS,
  StudyAreaTermAllocation,
} from '../src/curriculum/sources/caps-life-skills-r3.js';

describe('CAPS Life Skills Grades R-3 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(CAPS_LIFE_SKILLS_R3_METADATA.documentId).toBe(CAPS_LIFE_SKILLS_R3_DOC_ID);
      expect(CAPS_LIFE_SKILLS_R3_METADATA.documentVersion).toBe(
        CAPS_LIFE_SKILLS_R3_VERSION,
      );
    });

    it('is marked RATIFIED and not yet countersigned into L0', () => {
      expect(CAPS_LIFE_SKILLS_R3_METADATA.status).toBe('RATIFIED');
      expect(CAPS_LIFE_SKILLS_R3_METADATA.ratifiedBy).toBeNull();
    });

    it('covers the Foundation Phase, Grades R-3', () => {
      expect(CAPS_LIFE_SKILLS_R3_METADATA.phase).toBe('FOUNDATION');
      expect(CAPS_LIFE_SKILLS_R3_METADATA.grades).toStrictEqual(['R', '1', '2', '3']);
    });
  });

  describe('study area list', () => {
    it('contains exactly four study areas', () => {
      expect(CAPS_LIFE_SKILLS_R3_STUDY_AREAS).toHaveLength(4);
    });

    it('every study area validates against the StudyAreaTermAllocation schema', () => {
      for (const area of CAPS_LIFE_SKILLS_R3_STUDY_AREAS) {
        const result = StudyAreaTermAllocation.safeParse(area);
        expect(
          result.success,
          `area ${area.studyAreaId} failed: ${JSON.stringify('error' in result ? result.error.issues : [])}`,
        ).toBe(true);
      }
    });

    it('study area ids are all valid LifeSkillsStudyAreaId values', () => {
      for (const area of CAPS_LIFE_SKILLS_R3_STUDY_AREAS) {
        expect(LifeSkillsStudyAreaId.safeParse(area.studyAreaId).success).toBe(true);
      }
    });

    it('study area ids are unique', () => {
      const ids = CAPS_LIFE_SKILLS_R3_STUDY_AREAS.map((a) => a.studyAreaId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('time allocation — grade totals', () => {
    function sumForGrade(key: keyof typeof EXPECTED_LIFE_SKILLS_TERM_HOURS): number {
      return CAPS_LIFE_SKILLS_R3_STUDY_AREAS.reduce(
        (acc, a) => acc + a.hoursPerTerm[key],
        0,
      );
    }

    it('Grade R study areas sum to 60h/term (6h/week × 10 weeks)', () => {
      expect(sumForGrade('gradeR')).toBeCloseTo(EXPECTED_LIFE_SKILLS_TERM_HOURS.gradeR);
    });

    it('Grade 1 study areas sum to 60h/term (6h/week × 10 weeks)', () => {
      expect(sumForGrade('grade1')).toBeCloseTo(EXPECTED_LIFE_SKILLS_TERM_HOURS.grade1);
    });

    it('Grade 2 study areas sum to 60h/term (6h/week × 10 weeks)', () => {
      expect(sumForGrade('grade2')).toBeCloseTo(EXPECTED_LIFE_SKILLS_TERM_HOURS.grade2);
    });

    it('Grade 3 study areas sum to 70h/term (7h/week × 10 weeks)', () => {
      expect(sumForGrade('grade3')).toBeCloseTo(EXPECTED_LIFE_SKILLS_TERM_HOURS.grade3);
    });
  });

  describe('source provenance — every study area', () => {
    it('every source ref cites the correct document id', () => {
      for (const area of CAPS_LIFE_SKILLS_R3_STUDY_AREAS) {
        expect(area.source.documentId).toBe(CAPS_LIFE_SKILLS_R3_DOC_ID);
      }
    });

    it('every source ref is unratified (ratifiedBy is null)', () => {
      for (const area of CAPS_LIFE_SKILLS_R3_STUDY_AREAS) {
        expect(area.source.ratifiedBy).toBeNull();
      }
    });

    it('every source ref cites a page number', () => {
      for (const area of CAPS_LIFE_SKILLS_R3_STUDY_AREAS) {
        expect(area.source.page).toBeGreaterThan(0);
      }
    });
  });

  describe('failure paths', () => {
    it('rejects a study area with a negative hoursPerTerm value', () => {
      const invalid = {
        ...CAPS_LIFE_SKILLS_R3_STUDY_AREAS[0],
        hoursPerTerm: { gradeR: -1, grade1: 10, grade2: 10, grade3: 20 },
      };
      expect(StudyAreaTermAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a study area with an unknown studyAreaId', () => {
      const invalid = {
        ...CAPS_LIFE_SKILLS_R3_STUDY_AREAS[0],
        studyAreaId: 'not-a-real-area',
      };
      expect(StudyAreaTermAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a study area with zero hoursPerTerm (zero is not positive)', () => {
      const invalid = {
        ...CAPS_LIFE_SKILLS_R3_STUDY_AREAS[0],
        hoursPerTerm: { gradeR: 0, grade1: 10, grade2: 10, grade3: 20 },
      };
      expect(StudyAreaTermAllocation.safeParse(invalid).success).toBe(false);
    });
  });
});
