import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID =
  'doe-free-quality-education-2003' as const;
export const DOE_FREE_QUALITY_EDUCATION_2003_VERSION = '2003-06-14' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
    documentVersion: DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS = {
  /** Access to education: goals and targets. */
  accessGoals: ref('Section 1: Access — Goals and Targets', 3),
  /** School fee framework and fee-free schools policy. */
  schoolFeeFramework: ref('Section 2: School Fees — Fee-Free Schools Framework', 6),
  /** Quintile classification of schools for funding purposes. */
  quintileClassification: ref('Section 2.2: Quintile Classification of Schools', 8),
  /** Fee exemption criteria and administration. */
  feeExemptions: ref('Section 2.3: Fee Exemptions and Parental Liability', 9),
  /** Personnel and curriculum quality improvements. */
  personnelAndCurriculum: ref('Section 3: Personnel and Curriculum', 14),
} as const;

export const DOE_FREE_QUALITY_EDUCATION_2003_METADATA: PolicyDocMetadata = {
  documentId: DOE_FREE_QUALITY_EDUCATION_2003_DOC_ID,
  documentVersion: DOE_FREE_QUALITY_EDUCATION_2003_VERSION,
  title: 'Plan of Action: Improving access to free and quality basic education for all',
  publisher: 'Department of Education, Republic of South Africa',
  kind: 'PLAN',
  ratifiedBy: null,
};
