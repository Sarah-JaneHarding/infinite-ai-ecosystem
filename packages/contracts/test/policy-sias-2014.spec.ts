import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DBE_SIAS_2014_DOC_ID,
  DBE_SIAS_2014_METADATA,
  DBE_SIAS_2014_SECTIONS,
  DBE_SIAS_2014_VERSION,
  SiasSupportLevel,
} from '../src/policy/sources/dbe-sias-2014.js';

describe('SIAS Policy 2014 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DBE_SIAS_2014_METADATA.documentId).toBe(DBE_SIAS_2014_DOC_ID);
      expect(DBE_SIAS_2014_METADATA.documentVersion).toBe(DBE_SIAS_2014_VERSION);
    });

    it('is a POLICY kind and not yet countersigned into L0', () => {
      expect(DBE_SIAS_2014_METADATA.kind).toBe('POLICY');
      expect(DBE_SIAS_2014_METADATA.ratifiedBy).toBeNull();
    });

    it('records the correct page count', () => {
      expect(DBE_SIAS_2014_METADATA.pageCount).toBe(75);
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DBE_SIAS_2014_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DBE_SIAS_2014_DOC_ID);
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

    it('SBST composition section cites the correct clause and page', () => {
      expect(DBE_SIAS_2014_SECTIONS.sbstComposition.clause).toContain('§27');
      expect(DBE_SIAS_2014_SECTIONS.sbstComposition.page).toBe(29);
    });

    it('SBST role section cites §28', () => {
      expect(DBE_SIAS_2014_SECTIONS.sbstRoles.clause).toContain('§28');
    });

    it('SNA form section refs cite pages in correct order (SNA1 < SNA2 < SNA3)', () => {
      const p1 = DBE_SIAS_2014_SECTIONS.snA1Form.page ?? 0;
      const p2 = DBE_SIAS_2014_SECTIONS.snA2Form.page ?? 0;
      const p3 = DBE_SIAS_2014_SECTIONS.snA3Form.page ?? 0;
      expect(p1).toBeLessThan(p2);
      expect(p2).toBeLessThan(p3);
    });
  });

  describe('SiasSupportLevel enum', () => {
    it('accepts LOW, MODERATE, HIGH', () => {
      expect(SiasSupportLevel.safeParse('LOW').success).toBe(true);
      expect(SiasSupportLevel.safeParse('MODERATE').success).toBe(true);
      expect(SiasSupportLevel.safeParse('HIGH').success).toBe(true);
    });

    it('rejects an unlisted level', () => {
      expect(SiasSupportLevel.safeParse('CRITICAL').success).toBe(false);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_SIAS_2014_DOC_ID,
          documentVersion: DBE_SIAS_2014_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a negative page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_SIAS_2014_DOC_ID,
          documentVersion: DBE_SIAS_2014_VERSION,
          clause: '§27 SBST',
          page: -1,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
