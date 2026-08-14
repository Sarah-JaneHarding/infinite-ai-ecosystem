import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  SASA_1996_DOC_ID,
  SASA_1996_METADATA,
  SASA_1996_SECTIONS,
  SASA_1996_VERSION,
} from '../src/policy/sources/sasa-84-of-1996.js';

describe('SASA 84 of 1996 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(SASA_1996_METADATA.documentId).toBe(SASA_1996_DOC_ID);
      expect(SASA_1996_METADATA.documentVersion).toBe(SASA_1996_VERSION);
    });

    it('is an ACT kind and not yet countersigned into L0', () => {
      expect(SASA_1996_METADATA.kind).toBe('ACT');
      expect(SASA_1996_METADATA.ratifiedBy).toBeNull();
    });

    it('records the original assent date', () => {
      expect(SASA_1996_METADATA.dateAssented).toBe('1996-11-06');
    });

    it('version reflects the BELA-consolidated gazette date', () => {
      expect(SASA_1996_VERSION).toBe('2024-12-24');
    });

    it('gazette reference mentions GG 51836', () => {
      expect(SASA_1996_METADATA.gazetteRef).toContain('51836');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(SASA_1996_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(SASA_1996_DOC_ID);
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

    it('governing body functions section cites §20', () => {
      expect(SASA_1996_SECTIONS.governingBodyFunctions.clause).toContain('§20');
    });

    it('school fees section cites §39', () => {
      expect(SASA_1996_SECTIONS.schoolFees.clause).toContain('§39');
    });

    it('curriculum and assessment section cites §6A (inserted by BELA)', () => {
      expect(SASA_1996_SECTIONS.curriculumAndAssessment.clause).toContain('§6A');
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: SASA_1996_DOC_ID,
          documentVersion: SASA_1996_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: SASA_1996_DOC_ID,
          documentVersion: SASA_1996_VERSION,
          clause: '§3 Compulsory attendance',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
