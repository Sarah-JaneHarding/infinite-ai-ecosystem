import { z } from 'zod';

import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DBE_SIAS_2014_DOC_ID = 'dbe-sias-2014' as const;
export const DBE_SIAS_2014_VERSION = '2014-12-19' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DBE_SIAS_2014_DOC_ID,
    documentVersion: DBE_SIAS_2014_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

/** Level of support provision as defined in SIAS §15, Table 1. */
export const SiasSupportLevel = z.enum(['LOW', 'MODERATE', 'HIGH']);
export type SiasSupportLevel = z.infer<typeof SiasSupportLevel>;

export const DBE_SIAS_2014_SECTIONS = {
  /** Purpose of the SIAS policy and related legislation. */
  purposeAndLegislation: ref('Chapter 1 — Purpose and Related Legislation', 1),
  /** Rationale for inclusive education and the SIAS approach. */
  rationale: ref('Chapter 2 — Rationale for Inclusive Education', 6),
  /** Principles underpinning SIAS. */
  principles: ref('Chapter 3 — Principles Underpinning SIAS', 10),
  /** Level and nature of support: low, moderate and high. */
  levelsOfSupport: ref('Chapter 4 — Level and Nature of Support, §14–15, Table 1', 12),
  /** School-Based Support Team (SBST) composition. */
  sbstComposition: ref('§27 Composition of the School-Based Support Team (SBST)', 29),
  /** SBST roles and responsibilities in the SIAS process. */
  sbstRoles: ref('§28 Role of the SBST in the SIAS Process', 30),
  /** The SIAS process: six stages from initial concern to placement. */
  siasProcess: ref('Chapter 6 — The SIAS Process', 24),
  /** School Needs Assessment Form SNA 1 (completed by the teacher). */
  snA1Form: ref('Annexure B — SNA Form 1 (Teacher Assessment)', 49),
  /** School Needs Assessment Form SNA 2 (completed by SBST). */
  snA2Form: ref('Annexure C — SNA Form 2 (SBST Assessment)', 56),
  /** School Needs Assessment Form SNA 3 (completed by DBST). */
  snA3Form: ref('Annexure D — SNA Form 3 (DBST Assessment)', 61),
} as const;

export const DBE_SIAS_2014_METADATA: PolicyDocMetadata = {
  documentId: DBE_SIAS_2014_DOC_ID,
  documentVersion: DBE_SIAS_2014_VERSION,
  title: 'Policy on Screening, Identification, Assessment and Support',
  publisher: 'Department of Basic Education, Republic of South Africa',
  kind: 'POLICY',
  ratifiedBy: null,
  pageCount: 75,
};
