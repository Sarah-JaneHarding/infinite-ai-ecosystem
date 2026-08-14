import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  NEPA_1996_DOC_ID,
  NEPA_1996_METADATA,
  NEPA_1996_SECTIONS,
  NEPA_1996_VERSION,
} from '../src/policy/sources/nepa-27-of-1996.js';

describe('NEPA 27 of 1996 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(NEPA_1996_METADATA.documentId).toBe(NEPA_1996_DOC_ID);
      expect(NEPA_1996_METADATA.documentVersion).toBe(NEPA_1996_VERSION);
    });

    it('is an ACT kind and not yet countersigned into L0', () => {
      expect(NEPA_1996_METADATA.kind).toBe('ACT');
      expect(NEPA_1996_METADATA.ratifiedBy).toBeNull();
    });

    it('records the original assent date', () => {
      expect(NEPA_1996_METADATA.dateAssented).toBe('1996-04-16');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(NEPA_1996_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(NEPA_1996_DOC_ID);
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

    it('policy determination section cites §3', () => {
      expect(NEPA_1996_SECTIONS.policyDetermination.clause).toContain('§3');
    });

    it('Council of Education Ministers section cites §9', () => {
      expect(NEPA_1996_SECTIONS.councilOfEducationMinisters.clause).toContain('§9');
    });

    it('HEDCOM section cites §10', () => {
      expect(NEPA_1996_SECTIONS.hedcom.clause).toContain('§10');
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: NEPA_1996_DOC_ID,
          documentVersion: NEPA_1996_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: NEPA_1996_DOC_ID,
          documentVersion: NEPA_1996_VERSION,
          clause: '§3 Policy determination',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
