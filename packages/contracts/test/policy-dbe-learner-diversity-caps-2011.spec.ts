import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
  DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA,
  DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS,
  DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
} from '../src/policy/sources/dbe-learner-diversity-caps-2011.js';

describe('DBE Learner Diversity CAPS Guidelines 2011 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA.documentId).toBe(
        DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
      );
      expect(DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA.documentVersion).toBe(
        DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
      );
    });

    it('is a GUIDELINE kind and not yet countersigned into L0', () => {
      expect(DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA.kind).toBe('GUIDELINE');
      expect(DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA.ratifiedBy).toBeNull();
    });

    it('records the correct page count', () => {
      expect(DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA.pageCount).toBe(39);
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID);
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

    it('differentiation principles section cites page 6', () => {
      expect(
        DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS.differentiationPrinciples.page,
      ).toBe(6);
    });

    it('section pages are in ascending order across key sections', () => {
      const p1 =
        DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS.differentiationPrinciples.page ?? 0;
      const p2 = DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS.recordingAndReporting.page ?? 0;
      const p3 = DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS.accessingSupport.page ?? 0;
      expect(p1).toBeLessThan(p2);
      expect(p2).toBeLessThan(p3);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
          documentVersion: DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a negative page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
          documentVersion: DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
          clause: 'Section 2: Differentiation Principles',
          page: -5,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
