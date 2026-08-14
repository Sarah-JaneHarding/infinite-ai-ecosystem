import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  SACE_ACT_2000_DOC_ID,
  SACE_ACT_2000_METADATA,
  SACE_ACT_2000_SECTIONS,
  SACE_ACT_2000_VERSION,
} from '../src/policy/sources/sace-act-31-of-2000.js';

describe('SACE Act 31 of 2000 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(SACE_ACT_2000_METADATA.documentId).toBe(SACE_ACT_2000_DOC_ID);
      expect(SACE_ACT_2000_METADATA.documentVersion).toBe(SACE_ACT_2000_VERSION);
    });

    it('is an ACT kind and not yet countersigned into L0', () => {
      expect(SACE_ACT_2000_METADATA.kind).toBe('ACT');
      expect(SACE_ACT_2000_METADATA.ratifiedBy).toBeNull();
    });

    it('records the original assent date', () => {
      expect(SACE_ACT_2000_METADATA.dateAssented).toBe('2000-07-26');
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(SACE_ACT_2000_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(SACE_ACT_2000_DOC_ID);
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

    it('powers and duties section cites §5 (CPTD mandate)', () => {
      expect(SACE_ACT_2000_SECTIONS.powersAndDuties.clause).toContain('§5');
    });

    it('compulsory registration section cites §21', () => {
      expect(SACE_ACT_2000_SECTIONS.compulsoryRegistration.clause).toContain('§21');
    });

    it('removal from register section cites §23', () => {
      expect(SACE_ACT_2000_SECTIONS.removalFromRegister.clause).toContain('§23');
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: SACE_ACT_2000_DOC_ID,
          documentVersion: SACE_ACT_2000_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number', () => {
      expect(
        SourceRef.safeParse({
          documentId: SACE_ACT_2000_DOC_ID,
          documentVersion: SACE_ACT_2000_VERSION,
          clause: '§21 Compulsory registration',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
