import { describe, expect, it } from 'vitest';
import {
  CAPS_IP_LIFE_SKILLS_GR46_METADATA,
  CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS,
  CAPS_IP_LIFE_SKILLS_GR46_DOC_ID,
  CAPS_IP_LIFE_SKILLS_GR46_VERSION,
  IPLifeSkillsStudyAreaId,
  EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS,
  StudyAreaAnnualAllocation,
} from '../src/curriculum/sources/caps-life-skills-ip-gr46.js';

describe('CAPS Life Skills Intermediate Phase Grades 4-6 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentId).toBe(
        CAPS_IP_LIFE_SKILLS_GR46_DOC_ID,
      );
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentVersion).toBe(
        CAPS_IP_LIFE_SKILLS_GR46_VERSION,
      );
    });

    it('is marked RATIFIED and not yet countersigned into L0', () => {
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.status).toBe('RATIFIED');
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.ratifiedBy).toBeNull();
    });

    it('covers the Intermediate Phase, Grades 4-6', () => {
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.phase).toBe('INTERMEDIATE');
      expect(CAPS_IP_LIFE_SKILLS_GR46_METADATA.grades).toStrictEqual(['4', '5', '6']);
    });
  });

  describe('study area list', () => {
    it('contains exactly three study areas (Beginning Knowledge is Foundation Phase only)', () => {
      expect(CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS).toHaveLength(3);
    });

    it('every study area validates against the StudyAreaAnnualAllocation schema', () => {
      for (const area of CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS) {
        const result = StudyAreaAnnualAllocation.safeParse(area);
        expect(
          result.success,
          `area ${area.studyAreaId} failed: ${JSON.stringify('error' in result ? result.error.issues : [])}`,
        ).toBe(true);
      }
    });

    it('study area ids are all valid IPLifeSkillsStudyAreaId values', () => {
      for (const area of CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS) {
        expect(IPLifeSkillsStudyAreaId.safeParse(area.studyAreaId).success).toBe(true);
      }
    });

    it('study area ids are unique', () => {
      const ids = CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS.map((a) => a.studyAreaId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('time allocation — grade totals', () => {
    function sumForGrade(key: keyof typeof EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS): number {
      return CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS.reduce(
        (acc, a) => acc + a.hoursPerYear[key],
        0,
      );
    }

    it('Grade 4 study areas sum to 160h/year (4h/week × 40 weeks)', () => {
      expect(sumForGrade('grade4')).toBeCloseTo(
        EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS.grade4,
      );
    });

    it('Grade 5 study areas sum to 160h/year (4h/week × 40 weeks)', () => {
      expect(sumForGrade('grade5')).toBeCloseTo(
        EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS.grade5,
      );
    });

    it('Grade 6 study areas sum to 160h/year (4h/week × 40 weeks)', () => {
      expect(sumForGrade('grade6')).toBeCloseTo(
        EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS.grade6,
      );
    });
  });

  describe('source provenance — every study area', () => {
    it('every source ref cites the correct document id', () => {
      for (const area of CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS) {
        expect(area.source.documentId).toBe(CAPS_IP_LIFE_SKILLS_GR46_DOC_ID);
      }
    });

    it('every source ref is unratified (ratifiedBy is null)', () => {
      for (const area of CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS) {
        expect(area.source.ratifiedBy).toBeNull();
      }
    });

    it('every source ref cites a page number', () => {
      for (const area of CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS) {
        expect(area.source.page).toBeGreaterThan(0);
      }
    });
  });

  describe('failure paths', () => {
    it('rejects a study area with a negative hoursPerYear value', () => {
      const invalid = {
        ...CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS[0],
        hoursPerYear: { grade4: -1, grade5: 60, grade6: 60 },
      };
      expect(StudyAreaAnnualAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a study area with an unknown studyAreaId', () => {
      const invalid = {
        ...CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS[0],
        studyAreaId: 'beginning-knowledge',
      };
      expect(StudyAreaAnnualAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a study area with zero hoursPerYear (zero is not positive)', () => {
      const invalid = {
        ...CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS[0],
        hoursPerYear: { grade4: 0, grade5: 60, grade6: 60 },
      };
      expect(StudyAreaAnnualAllocation.safeParse(invalid).success).toBe(false);
    });
  });
});
