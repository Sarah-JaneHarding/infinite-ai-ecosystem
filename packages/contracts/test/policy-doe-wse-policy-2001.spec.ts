import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DOE_WSE_POLICY_2001_DOC_ID,
  DOE_WSE_POLICY_2001_METADATA,
  DOE_WSE_POLICY_2001_SECTIONS,
  DOE_WSE_POLICY_2001_VERSION,
  WSE_EVALUATION_AREAS,
  WsePerformanceRating,
} from '../src/policy/sources/doe-wse-policy-2001.js';

describe('DoE Whole-School Evaluation Policy 2001 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DOE_WSE_POLICY_2001_METADATA.documentId).toBe(DOE_WSE_POLICY_2001_DOC_ID);
      expect(DOE_WSE_POLICY_2001_METADATA.documentVersion).toBe(
        DOE_WSE_POLICY_2001_VERSION,
      );
    });

    it('is a POLICY kind and not yet countersigned into L0', () => {
      expect(DOE_WSE_POLICY_2001_METADATA.kind).toBe('POLICY');
      expect(DOE_WSE_POLICY_2001_METADATA.ratifiedBy).toBeNull();
    });

    it('records the correct gazette reference', () => {
      expect(DOE_WSE_POLICY_2001_METADATA.gazetteRef).toContain('22512');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DOE_WSE_POLICY_2001_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DOE_WSE_POLICY_2001_DOC_ID);
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

    it('evaluation areas section cites page 7', () => {
      expect(DOE_WSE_POLICY_2001_SECTIONS.evaluationAreas.page).toBe(7);
    });

    it('performance ratings section cites page 10', () => {
      expect(DOE_WSE_POLICY_2001_SECTIONS.performanceRatings.page).toBe(10);
    });
  });

  describe('WSE_EVALUATION_AREAS constant', () => {
    it('contains exactly seven areas', () => {
      expect(WSE_EVALUATION_AREAS).toHaveLength(7);
    });

    it('includes teaching and learning as an area', () => {
      expect(WSE_EVALUATION_AREAS).toContain('Teaching and learning');
    });
  });

  describe('WsePerformanceRating schema', () => {
    it('accepts ratings 1 through 4', () => {
      expect(WsePerformanceRating.safeParse(1).success).toBe(true);
      expect(WsePerformanceRating.safeParse(2).success).toBe(true);
      expect(WsePerformanceRating.safeParse(3).success).toBe(true);
      expect(WsePerformanceRating.safeParse(4).success).toBe(true);
    });

    it('rejects rating 0', () => {
      expect(WsePerformanceRating.safeParse(0).success).toBe(false);
    });

    it('rejects rating 5', () => {
      expect(WsePerformanceRating.safeParse(5).success).toBe(false);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_WSE_POLICY_2001_DOC_ID,
          documentVersion: DOE_WSE_POLICY_2001_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_WSE_POLICY_2001_DOC_ID,
          documentVersion: DOE_WSE_POLICY_2001_VERSION,
          clause: '§5 Areas of Evaluation',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
