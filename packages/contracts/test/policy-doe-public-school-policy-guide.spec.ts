import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS,
  DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
} from '../src/policy/sources/doe-public-school-policy-guide.js';

describe('DoE Public School Policy Guide source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA.documentId).toBe(
        DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
      );
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA.documentVersion).toBe(
        DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
      );
    });

    it('is a GUIDELINE kind and not yet countersigned into L0', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA.kind).toBe('GUIDELINE');
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA.ratifiedBy).toBeNull();
    });

    it('has the correct page count', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA.pageCount).toBe(2);
    });

    it('version is recorded as undated (no fabricated date)', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION).toBe('undated');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID);
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

    it('language policy section cites page 2', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS.languagePolicy.page).toBe(2);
    });

    it('admissions section cites page 1', () => {
      expect(DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS.admissions.page).toBe(1);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
          documentVersion: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
          documentVersion: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
          clause: 'Admissions and Allocation to Schools',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
