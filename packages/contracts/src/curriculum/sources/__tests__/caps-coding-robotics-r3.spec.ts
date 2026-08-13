import { describe, expect, it } from 'vitest';
import {
  CAPS_CR_R3_METADATA,
  CAPS_CR_R3_STRANDS,
  CAPS_CODING_ROBOTICS_R3_DOC_ID,
  CAPS_CODING_ROBOTICS_R3_VERSION,
  CodingRoboticsStrandId,
  EXPECTED_TERM_HOURS,
  StrandTermAllocation,
} from '../caps-coding-robotics-r3.js';

describe('CAPS Coding and Robotics Grades R-3 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(CAPS_CR_R3_METADATA.documentId).toBe(CAPS_CODING_ROBOTICS_R3_DOC_ID);
      expect(CAPS_CR_R3_METADATA.documentVersion).toBe(CAPS_CODING_ROBOTICS_R3_VERSION);
    });

    it('is marked DRAFT and not yet ratified', () => {
      expect(CAPS_CR_R3_METADATA.status).toBe('DRAFT');
      expect(CAPS_CR_R3_METADATA.ratifiedBy).toBeNull();
    });

    it('covers the Foundation Phase, Grades R-3', () => {
      expect(CAPS_CR_R3_METADATA.phase).toBe('FOUNDATION');
      expect(CAPS_CR_R3_METADATA.grades).toStrictEqual(['R', '1', '2', '3']);
    });
  });

  describe('strand list', () => {
    it('contains exactly five strands', () => {
      expect(CAPS_CR_R3_STRANDS).toHaveLength(5);
    });

    it('every strand validates against the StrandTermAllocation schema', () => {
      for (const strand of CAPS_CR_R3_STRANDS) {
        const result = StrandTermAllocation.safeParse(strand);
        expect(
          result.success,
          `strand ${strand.strandId} failed: ${JSON.stringify('error' in result ? result.error.issues : [])}`,
        ).toBe(true);
      }
    });

    it('strand ids are all valid CodingRoboticsStrandId values', () => {
      const ids = CAPS_CR_R3_STRANDS.map((s) => s.strandId);
      for (const id of ids) {
        expect(CodingRoboticsStrandId.safeParse(id).success).toBe(true);
      }
    });

    it('strand ids are unique', () => {
      const ids = CAPS_CR_R3_STRANDS.map((s) => s.strandId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('time allocation — grade totals', () => {
    function sumForGrade(key: keyof typeof EXPECTED_TERM_HOURS): number {
      return CAPS_CR_R3_STRANDS.reduce((acc, s) => acc + s.hoursPerTerm[key], 0);
    }

    it('Grade R strands sum to 10h/term (1h/week × 10 weeks)', () => {
      expect(sumForGrade('gradeR')).toBeCloseTo(EXPECTED_TERM_HOURS.gradeR);
    });

    it('Grade 1 strands sum to 10h/term (1h/week × 10 weeks)', () => {
      expect(sumForGrade('grade1')).toBeCloseTo(EXPECTED_TERM_HOURS.grade1);
    });

    it('Grade 2 strands sum to 10h/term (1h/week × 10 weeks)', () => {
      expect(sumForGrade('grade2')).toBeCloseTo(EXPECTED_TERM_HOURS.grade2);
    });

    it('Grade 3 strands sum to 20h/term (2h/week × 10 weeks)', () => {
      expect(sumForGrade('grade3')).toBeCloseTo(EXPECTED_TERM_HOURS.grade3);
    });
  });

  describe('source provenance — every strand', () => {
    it('every source ref cites the correct document id', () => {
      for (const strand of CAPS_CR_R3_STRANDS) {
        expect(strand.source.documentId).toBe(CAPS_CODING_ROBOTICS_R3_DOC_ID);
      }
    });

    it('every source ref is unratified (ratifiedBy is null)', () => {
      for (const strand of CAPS_CR_R3_STRANDS) {
        expect(strand.source.ratifiedBy).toBeNull();
      }
    });

    it('every source ref cites a page number', () => {
      for (const strand of CAPS_CR_R3_STRANDS) {
        expect(strand.source.page).toBeGreaterThan(0);
      }
    });
  });

  describe('failure paths', () => {
    it('rejects a strand with a negative hoursPerTerm value', () => {
      const invalid = {
        ...CAPS_CR_R3_STRANDS[0],
        hoursPerTerm: { gradeR: -1, grade1: 2.5, grade2: 1.5, grade3: 2 },
      };
      expect(StrandTermAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a strand with an unknown strandId', () => {
      const invalid = { ...CAPS_CR_R3_STRANDS[0], strandId: 'not-a-real-strand' };
      expect(StrandTermAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a strand with zero hoursPerTerm (zero is not positive)', () => {
      const invalid = {
        ...CAPS_CR_R3_STRANDS[0],
        hoursPerTerm: { gradeR: 0, grade1: 2.5, grade2: 1.5, grade3: 2 },
      };
      expect(StrandTermAllocation.safeParse(invalid).success).toBe(false);
    });
  });
});
