import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DBE_NPFTED_2007_DOC_ID,
  DBE_NPFTED_2007_METADATA,
  DBE_NPFTED_2007_SECTIONS,
  DBE_NPFTED_2007_VERSION,
} from '../src/policy/sources/dbe-npfted-2007.js';

describe('DBE NPFTED 2007 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DBE_NPFTED_2007_METADATA.documentId).toBe(DBE_NPFTED_2007_DOC_ID);
      expect(DBE_NPFTED_2007_METADATA.documentVersion).toBe(DBE_NPFTED_2007_VERSION);
    });

    it('is a FRAMEWORK kind and not yet countersigned into L0', () => {
      expect(DBE_NPFTED_2007_METADATA.kind).toBe('FRAMEWORK');
      expect(DBE_NPFTED_2007_METADATA.ratifiedBy).toBeNull();
    });

    it('records the correct gazette reference', () => {
      expect(DBE_NPFTED_2007_METADATA.gazetteRef).toContain('29832');
      expect(DBE_NPFTED_2007_METADATA.gazetteRef).toContain('2007');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DBE_NPFTED_2007_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DBE_NPFTED_2007_DOC_ID);
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

    it('CPTD system section cites page 17', () => {
      expect(DBE_NPFTED_2007_SECTIONS.cptdSystem.page).toBe(17);
    });

    it('IPET framework section cites page 10', () => {
      expect(DBE_NPFTED_2007_SECTIONS.ipetFramework.page).toBe(10);
    });

    it('CPTD pages are in ascending order', () => {
      const cptdSystem = DBE_NPFTED_2007_SECTIONS.cptdSystem.page ?? 0;
      const cptdActivities = DBE_NPFTED_2007_SECTIONS.cptdActivities.page ?? 0;
      const cptdManagement = DBE_NPFTED_2007_SECTIONS.cptdManagement.page ?? 0;
      expect(cptdSystem).toBeLessThan(cptdActivities);
      expect(cptdActivities).toBeLessThan(cptdManagement);
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_NPFTED_2007_DOC_ID,
          documentVersion: DBE_NPFTED_2007_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a negative page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_NPFTED_2007_DOC_ID,
          documentVersion: DBE_NPFTED_2007_VERSION,
          clause: '§5 CPTD',
          page: -1,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
