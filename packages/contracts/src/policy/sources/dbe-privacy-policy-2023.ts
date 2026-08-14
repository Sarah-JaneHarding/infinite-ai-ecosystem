import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DBE_PRIVACY_POLICY_2023_DOC_ID = 'dbe-privacy-policy-2023' as const;
export const DBE_PRIVACY_POLICY_2023_VERSION = '2023-01-17' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DBE_PRIVACY_POLICY_2023_DOC_ID,
    documentVersion: DBE_PRIVACY_POLICY_2023_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const DBE_PRIVACY_POLICY_2023_SECTIONS = {
  /** Scope and purpose of the DBE Privacy Policy. */
  scopeAndPurpose: ref('§1 Introduction and Purpose', 1),
  /** Categories of personal information processed by DBE. */
  personalInformationCategories: ref(
    '§3 Categories of Personal Information Processed',
    3,
  ),
  /** Processing of children's personal information under POPIA §34–35. */
  childrenPersonalInfo: ref('§5 Special Personal Information — Children', 6),
  /** Data subject rights including access, correction and deletion. */
  dataSubjectRights: ref('§6 Rights of Data Subjects', 7),
  /** Disclosure conditions and third-party sharing rules. */
  disclosureConditions: ref('§7 Disclosure of Personal Information', 8),
} as const;

export const DBE_PRIVACY_POLICY_2023_METADATA: PolicyDocMetadata = {
  documentId: DBE_PRIVACY_POLICY_2023_DOC_ID,
  documentVersion: DBE_PRIVACY_POLICY_2023_VERSION,
  title: 'Department of Basic Education Privacy Policy',
  publisher: 'Department of Basic Education, Republic of South Africa',
  kind: 'POLICY',
  ratifiedBy: null,
  pageCount: 9,
};
