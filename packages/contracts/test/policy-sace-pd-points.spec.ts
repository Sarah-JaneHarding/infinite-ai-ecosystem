import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  SACE_CPTD_CYCLE_YEARS,
  SACE_CPTD_TOTAL_PD_POINTS,
  SACE_PD_POINTS_SCHEDULE_DOC_ID,
  SACE_PD_POINTS_SCHEDULE_METADATA,
  SACE_PD_POINTS_SCHEDULE_SECTIONS,
  SACE_PD_POINTS_SCHEDULE_VERSION,
  SacePdActivityType,
} from '../src/policy/sources/sace-pd-points-schedule.js';

describe('SACE PD Points Schedule source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(SACE_PD_POINTS_SCHEDULE_METADATA.documentId).toBe(
        SACE_PD_POINTS_SCHEDULE_DOC_ID,
      );
      expect(SACE_PD_POINTS_SCHEDULE_METADATA.documentVersion).toBe(
        SACE_PD_POINTS_SCHEDULE_VERSION,
      );
    });

    it('is a SCHEDULE kind and not yet countersigned into L0', () => {
      expect(SACE_PD_POINTS_SCHEDULE_METADATA.kind).toBe('SCHEDULE');
      expect(SACE_PD_POINTS_SCHEDULE_METADATA.ratifiedBy).toBeNull();
    });
  });

  describe('CPTD constants', () => {
    it('requires 150 PD points per cycle', () => {
      expect(SACE_CPTD_TOTAL_PD_POINTS).toBe(150);
    });

    it('cycle duration is 3 years', () => {
      expect(SACE_CPTD_CYCLE_YEARS).toBe(3);
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(SACE_PD_POINTS_SCHEDULE_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(SACE_PD_POINTS_SCHEDULE_DOC_ID);
      }
    });

    it('every section ref is unratified', () => {
      for (const s of sections) {
        expect(s.ratifiedBy).toBeNull();
      }
    });

    it('every section ref validates against the SourceRef schema', () => {
      for (const s of sections) {
        expect(SourceRef.safeParse(s).success).toBe(true);
      }
    });

    it('total points requirement section cites page 2', () => {
      expect(SACE_PD_POINTS_SCHEDULE_SECTIONS.totalPointsRequirement.page).toBe(2);
    });
  });

  describe('SacePdActivityType enum', () => {
    it('accepts all three activity types', () => {
      expect(SacePdActivityType.safeParse('TYPE_1_TEACHER_INITIATED').success).toBe(true);
      expect(SacePdActivityType.safeParse('TYPE_2_SCHOOL_INITIATED').success).toBe(true);
      expect(SacePdActivityType.safeParse('TYPE_3_EXTERNALLY_INITIATED').success).toBe(
        true,
      );
    });

    it('rejects an unlisted activity type', () => {
      expect(SacePdActivityType.safeParse('TYPE_4_MANDATORY').success).toBe(false);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: SACE_PD_POINTS_SCHEDULE_DOC_ID,
          documentVersion: SACE_PD_POINTS_SCHEDULE_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: SACE_PD_POINTS_SCHEDULE_DOC_ID,
          documentVersion: SACE_PD_POINTS_SCHEDULE_VERSION,
          clause: 'Total points requirement',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
