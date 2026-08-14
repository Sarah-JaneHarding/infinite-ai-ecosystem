import { describe, expect, it } from 'vitest';
import { SourceRef } from '../src/curriculum/framework.js';
import {
  DBE_PRIVACY_POLICY_2023_DOC_ID,
  DBE_PRIVACY_POLICY_2023_METADATA,
  DBE_PRIVACY_POLICY_2023_SECTIONS,
  DBE_PRIVACY_POLICY_2023_VERSION,
} from '../src/policy/sources/dbe-privacy-policy-2023.js';

describe('DBE Privacy Policy 2023 source registration', () => {
  describe('document metadata', () => {
    it('has the correct document id and version', () => {
      expect(DBE_PRIVACY_POLICY_2023_METADATA.documentId).toBe(
        DBE_PRIVACY_POLICY_2023_DOC_ID,
      );
      expect(DBE_PRIVACY_POLICY_2023_METADATA.documentVersion).toBe(
        DBE_PRIVACY_POLICY_2023_VERSION,
      );
    });

    it('is a POLICY kind and not yet countersigned into L0', () => {
      expect(DBE_PRIVACY_POLICY_2023_METADATA.kind).toBe('POLICY');
      expect(DBE_PRIVACY_POLICY_2023_METADATA.ratifiedBy).toBeNull();
    });

    it('has the correct publisher', () => {
      expect(DBE_PRIVACY_POLICY_2023_METADATA.publisher).toBe(
        'Department of Basic Education, Republic of South Africa',
      );
    });
  });

  describe('section source refs', () => {
    const sections = Object.values(DBE_PRIVACY_POLICY_2023_SECTIONS);

    it('every section ref cites the correct document id', () => {
      for (const s of sections) {
        expect(s.documentId).toBe(DBE_PRIVACY_POLICY_2023_DOC_ID);
      }
    });

    it('every section ref is unratified', () => {
      for (const s of sections) {
        expect(s.ratifiedBy).toBeNull();
      }
    });

    it('every section ref has a non-empty clause', () => {
      for (const s of sections) {
        expect(s.clause.length).toBeGreaterThan(0);
      }
    });

    it('every section ref validates against the SourceRef schema', () => {
      for (const s of sections) {
        expect(SourceRef.safeParse(s).success).toBe(true);
      }
    });
  });

  describe('failure paths', () => {
    it('SourceRef rejects an empty clause', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_PRIVACY_POLICY_2023_DOC_ID,
          documentVersion: DBE_PRIVACY_POLICY_2023_VERSION,
          clause: '',
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });

    it('SourceRef rejects a zero page number (must be positive)', () => {
      expect(
        SourceRef.safeParse({
          documentId: DBE_PRIVACY_POLICY_2023_DOC_ID,
          documentVersion: DBE_PRIVACY_POLICY_2023_VERSION,
          clause: '§1 Introduction',
          page: 0,
          ratifiedBy: null,
        }).success,
      ).toBe(false);
    });
  });
});
