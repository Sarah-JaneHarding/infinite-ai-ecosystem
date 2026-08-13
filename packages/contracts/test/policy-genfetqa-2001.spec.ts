import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  GENFETQA_2001_DOC_ID,
  GENFETQA_2001_METADATA,
  GENFETQA_2001_SECTIONS,
  GENFETQA_2001_VERSION,
} from '../src/policy/sources/genfetqa-58-of-2001.js';

describe('GENFETQA 58 of 2001 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(GENFETQA_2001_METADATA.documentId).toBe(GENFETQA_2001_DOC_ID);
      expect(GENFETQA_2001_METADATA.documentVersion).toBe(GENFETQA_2001_VERSION);
    });

    it('is an ACT kind and not yet countersigned into L0', () => {
      expect(GENFETQA_2001_METADATA.kind).toBe('ACT');
      expect(GENFETQA_2001_METADATA.ratifiedBy).toBeNull();
    });

    it('records the original assent date', () => {
      expect(GENFETQA_2001_METADATA.dateAssented).toBe('2001-11-29');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(GENFETQA_2001_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(GENFETQA_2001_DOC_ID);
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

    it('establishment of council section clause names Umalusi', () => {
      expect(GENFETQA_2001_SECTIONS.establishmentOfCouncil.clause).toContain('Umalusi');
    });

    it('external assessment section cites §17A', () => {
      expect(GENFETQA_2001_SECTIONS.externalAssessment.clause).toContain('§17A');
    });

    it('internal assessment section cites §17', () => {
      expect(GENFETQA_2001_SECTIONS.internalAssessment.clause).toContain('§17');
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: GENFETQA_2001_DOC_ID,
          documentVersion: GENFETQA_2001_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a negative page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: GENFETQA_2001_DOC_ID,
          documentVersion: GENFETQA_2001_VERSION,
          clause: '§4 Establishment of Council',
          page: -1,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
