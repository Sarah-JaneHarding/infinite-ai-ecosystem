import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  EEA_1998_DOC_ID,
  EEA_1998_METADATA,
  EEA_1998_SECTIONS,
  EEA_1998_VERSION,
} from '../src/policy/sources/eea-76-of-1998.js';

describe('EEA 76 of 1998 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(EEA_1998_METADATA.documentId).toBe(EEA_1998_DOC_ID);
      expect(EEA_1998_METADATA.documentVersion).toBe(EEA_1998_VERSION);
    });

    it('is an ACT kind and not yet countersigned into L0', () => {
      expect(EEA_1998_METADATA.kind).toBe('ACT');
      expect(EEA_1998_METADATA.ratifiedBy).toBeNull();
    });

    it('records the original assent date', () => {
      expect(EEA_1998_METADATA.dateAssented).toBe('1998-09-30');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(EEA_1998_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(EEA_1998_DOC_ID);
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

    it('serious misconduct section cites §17', () => {
      expect(EEA_1998_SECTIONS.seriousMisconduct.clause).toContain('§17');
    });

    it('SACE records section cites §26', () => {
      expect(EEA_1998_SECTIONS.saceRecords.clause).toContain('§26');
    });

    it('appeals section cites §25', () => {
      expect(EEA_1998_SECTIONS.appeals.clause).toContain('§25');
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: EEA_1998_DOC_ID,
          documentVersion: EEA_1998_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a negative page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: EEA_1998_DOC_ID,
          documentVersion: EEA_1998_VERSION,
          clause: '§17 Serious misconduct',
          page: -3,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
