import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DBE_NPFTED_2007_DOC_ID = 'dbe-npfted-2007' as const;
export const DBE_NPFTED_2007_VERSION = '2007-04-26' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DBE_NPFTED_2007_DOC_ID,
    documentVersion: DBE_NPFTED_2007_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const DBE_NPFTED_2007_SECTIONS = {
  /** Scope and purpose of the National Policy Framework for Teacher Education. */
  scopeAndPurpose: ref('§1 Introduction: Scope and Purpose', 2),
  /** Guiding principles for teacher education and development. */
  guidingPrinciples: ref('§2 Principles Underpinning the Policy Framework', 4),
  /** Initial Professional Education of Teachers (IPET) framework. */
  ipetFramework: ref('§4 Initial Professional Education of Teachers (IPET)', 10),
  /** Continuing Professional Teacher Development (CPTD) system. */
  cptdSystem: ref('§5 Continuing Professional Teacher Development (CPTD)', 17),
  /** CPTD activities and professional development planning. */
  cptdActivities: ref('§5.2 Professional Development Activities and Planning', 18),
  /** CPTD management and the role of SACE. */
  cptdManagement: ref('§5.3 CPTD Management System and SACE', 19),
} as const;

export const DBE_NPFTED_2007_METADATA: PolicyDocMetadata = {
  documentId: DBE_NPFTED_2007_DOC_ID,
  documentVersion: DBE_NPFTED_2007_VERSION,
  title:
    'The National Policy Framework for Teacher Education and Development in South Africa ("More teachers, better teachers")',
  publisher: 'Department of Education, Republic of South Africa',
  kind: 'FRAMEWORK',
  gazetteRef: 'Government Gazette No. 29832, Vol. 502, 26 April 2007, Notice No. 367',
  ratifiedBy: null,
};
