import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  BELA_ACT_2024_DOC_ID,
  BELA_ACT_2024_METADATA,
  BELA_ACT_2024_SECTIONS,
  BELA_ACT_2024_VERSION,
} from '../src/policy/sources/bela-act-32-of-2024.js';

describe('BELA Act 32 of 2024 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(BELA_ACT_2024_METADATA.documentId).toBe(BELA_ACT_2024_DOC_ID);
      expect(BELA_ACT_2024_METADATA.documentVersion).toBe(BELA_ACT_2024_VERSION);
    });

    it('is an AMENDMENT_ACT kind and not yet countersigned into L0', () => {
      expect(BELA_ACT_2024_METADATA.kind).toBe('AMENDMENT_ACT');
      expect(BELA_ACT_2024_METADATA.ratifiedBy).toBeNull();
    });

    it('records the correct assent date', () => {
      expect(BELA_ACT_2024_METADATA.dateAssented).toBe('2024-09-13');
    });

    it('records the correct gazette reference', () => {
      expect(BELA_ACT_2024_METADATA.gazetteRef).toContain('51258');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(BELA_ACT_2024_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(BELA_ACT_2024_DOC_ID);
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

    it('Grade R attendance section clause references SASA §3', () => {
      expect(BELA_ACT_2024_SECTIONS.gradeRCompulsoryAttendance.clause).toContain('§3');
    });

    it('corporal punishment section clause mentions §10', () => {
      expect(BELA_ACT_2024_SECTIONS.corporalPunishmentProhibition.clause).toContain(
        '§10',
      );
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: BELA_ACT_2024_DOC_ID,
          documentVersion: BELA_ACT_2024_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: BELA_ACT_2024_DOC_ID,
          documentVersion: BELA_ACT_2024_VERSION,
          clause: 'BELA §1 amending SASA §3',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
