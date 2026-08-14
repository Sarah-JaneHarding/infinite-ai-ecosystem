import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The DoE fold-out pamphlet has no visible publication date; it references SASA 79 of 1996
// and the quintile system, suggesting 2006–2009. Version is recorded as 'undated' because
// inventing a date would break the provenance chain.
export const DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID =
  'doe-public-school-policy-guide' as const;
export const DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION = 'undated' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
    documentVersion: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const DOE_PUBLIC_SCHOOL_POLICY_GUIDE_SECTIONS = {
  /** Admissions and school allocation rules. */
  admissions: ref('Admissions and Allocation to Schools', 1),
  /** School fees and the quintile funding system. */
  schoolFees: ref('School Fees and School Funds', 1),
  /** Fee exemption eligibility and process. */
  feeExemptions: ref('School Fee Exemptions', 1),
  /** Quintile classification of schools and no-fee schools. */
  quintileSystem: ref('Quintile System and No-Fee Schools', 1),
  /** Language of learning and teaching policy. */
  languagePolicy: ref('Language Policy at Schools', 2),
  /** Parent and learner rights and responsibilities. */
  rightsAndResponsibilities: ref(
    'Rights and Responsibilities of Parents and Learners',
    2,
  ),
} as const;

export const DOE_PUBLIC_SCHOOL_POLICY_GUIDE_METADATA: PolicyDocMetadata = {
  documentId: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_DOC_ID,
  documentVersion: DOE_PUBLIC_SCHOOL_POLICY_GUIDE_VERSION,
  title:
    'Rights and Responsibilities of Parents, Learners and Public Schools: A Public School Policy Guide',
  publisher: 'Department of Education, Republic of South Africa',
  kind: 'GUIDELINE',
  ratifiedBy: null,
  pageCount: 2,
};
