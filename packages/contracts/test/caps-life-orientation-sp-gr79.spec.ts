import { describe, expect, it } from 'vitest';
import {
  CAPS_LO_SP_GR79_METADATA,
  CAPS_LO_SP_GR79_TOPICS,
  CAPS_LO_SP_GR79_DOC_ID,
  CAPS_LO_SP_GR79_VERSION,
  LifeOrientationTopicId,
  EXPECTED_LO_CONTACT_HOURS,
  TopicAnnualAllocation,
} from '../src/curriculum/sources/caps-life-orientation-sp-gr79.js';

describe('CAPS Life Orientation Senior Phase Grades 7-9 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(CAPS_LO_SP_GR79_METADATA.documentId).toBe(CAPS_LO_SP_GR79_DOC_ID);
      expect(CAPS_LO_SP_GR79_METADATA.documentVersion).toBe(CAPS_LO_SP_GR79_VERSION);
    });

    it('is marked RATIFIED and not yet countersigned into L0', () => {
      expect(CAPS_LO_SP_GR79_METADATA.status).toBe('RATIFIED');
      expect(CAPS_LO_SP_GR79_METADATA.ratifiedBy).toBeNull();
    });

    it('covers the Senior Phase, Grades 7-9', () => {
      expect(CAPS_LO_SP_GR79_METADATA.phase).toBe('SENIOR');
      expect(CAPS_LO_SP_GR79_METADATA.grades).toStrictEqual(['7', '8', '9']);
    });
  });

  describe('topic list', () => {
    it('contains exactly five topics', () => {
      expect(CAPS_LO_SP_GR79_TOPICS).toHaveLength(5);
    });

    it('every topic validates against the TopicAnnualAllocation schema', () => {
      for (const topic of CAPS_LO_SP_GR79_TOPICS) {
        const result = TopicAnnualAllocation.safeParse(topic);
        expect(
          result.success,
          `topic ${topic.topicId} failed: ${JSON.stringify('error' in result ? result.error.issues : [])}`,
        ).toBe(true);
      }
    });

    it('topic ids are all valid LifeOrientationTopicId values', () => {
      for (const topic of CAPS_LO_SP_GR79_TOPICS) {
        expect(LifeOrientationTopicId.safeParse(topic.topicId).success).toBe(true);
      }
    });

    it('topic ids are unique', () => {
      const ids = CAPS_LO_SP_GR79_TOPICS.map((t) => t.topicId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('time allocation — grade totals', () => {
    function sumForGrade(key: keyof typeof EXPECTED_LO_CONTACT_HOURS): number {
      return CAPS_LO_SP_GR79_TOPICS.reduce((acc, t) => acc + t.hoursPerYear[key], 0);
    }

    it('Grade 7 topics sum to 70h contact time (2h/week × 40 weeks − 10h exams)', () => {
      expect(sumForGrade('grade7')).toBeCloseTo(EXPECTED_LO_CONTACT_HOURS.grade7);
    });

    it('Grade 8 topics sum to 70h contact time (2h/week × 40 weeks − 10h exams)', () => {
      expect(sumForGrade('grade8')).toBeCloseTo(EXPECTED_LO_CONTACT_HOURS.grade8);
    });

    it('Grade 9 topics sum to 70h contact time (2h/week × 40 weeks − 10h exams)', () => {
      expect(sumForGrade('grade9')).toBeCloseTo(EXPECTED_LO_CONTACT_HOURS.grade9);
    });
  });

  describe('source provenance — every topic', () => {
    it('every source ref cites the correct document id', () => {
      for (const topic of CAPS_LO_SP_GR79_TOPICS) {
        expect(topic.source.documentId).toBe(CAPS_LO_SP_GR79_DOC_ID);
      }
    });

    it('every source ref is unratified (ratifiedBy is null)', () => {
      for (const topic of CAPS_LO_SP_GR79_TOPICS) {
        expect(topic.source.ratifiedBy).toBeNull();
      }
    });

    it('every source ref cites a page number', () => {
      for (const topic of CAPS_LO_SP_GR79_TOPICS) {
        expect(topic.source.page).toBeGreaterThan(0);
      }
    });
  });

  describe('failure paths', () => {
    it('rejects a topic with a negative hoursPerYear value', () => {
      const invalid = {
        ...CAPS_LO_SP_GR79_TOPICS[0],
        hoursPerYear: { grade7: -1, grade8: 9, grade9: 10 },
      };
      expect(TopicAnnualAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a topic with an unknown topicId', () => {
      const invalid = {
        ...CAPS_LO_SP_GR79_TOPICS[0],
        topicId: 'not-a-real-topic',
      };
      expect(TopicAnnualAllocation.safeParse(invalid).success).toBe(false);
    });

    it('rejects a topic with zero hoursPerYear (zero is not positive)', () => {
      const invalid = {
        ...CAPS_LO_SP_GR79_TOPICS[0],
        hoursPerYear: { grade7: 0, grade8: 9, grade9: 10 },
      };
      expect(TopicAnnualAllocation.safeParse(invalid).success).toBe(false);
    });
  });
});
