import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
  DOE_FREE_QUALITY_EDUCATION_2003_METADATA,
  DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS,
  DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
} from '../src/policy/sources/doe-free-quality-education-2003.js';

describe('DoE Free Quality Education Plan 2003 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DOE_FREE_QUALITY_EDUCATION_2003_METADATA.documentId).toBe(
        DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
      );
      expect(DOE_FREE_QUALITY_EDUCATION_2003_METADATA.documentVersion).toBe(
        DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
      );
    });

    it('is a PLAN kind and not yet countersigned into L0', () => {
      expect(DOE_FREE_QUALITY_EDUCATION_2003_METADATA.kind).toBe('PLAN');
      expect(DOE_FREE_QUALITY_EDUCATION_2003_METADATA.ratifiedBy).toBeNull();
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID);
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

    it('quintile classification section cites page 8', () => {
      expect(DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.quintileClassification.page).toBe(
        8,
      );
    });

    it('section pages are in ascending order', () => {
      const p1 = DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.accessGoals.page ?? 0;
      const p2 = DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.schoolFeeFramework.page ?? 0;
      const p3 =
        DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.quintileClassification.page ?? 0;
      expect(p1).toBeLessThan(p2);
      expect(p2).toBeLessThan(p3);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
          documentVersion: DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
          documentVersion: DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
          clause: 'Section 2: School Fees',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
