import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The version supplied is the consolidated text updated to Government Gazette 34620
// dated 19 September 2011 (incorporating amendments through BELA Act 15 of 2011).
export const GENFETQA_2001_DOC_ID = 'genfetqa-58-of-2001' as const;
export const GENFETQA_2001_VERSION = '2011-09-19' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: GENFETQA_2001_DOC_ID,
    documentVersion: GENFETQA_2001_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const GENFETQA_2001_SECTIONS = {
  /** §1 Definitions: accreditation, assessment, assessment body, Council, etc. */
  definitions: ref('§1 Definitions'),
  /** §2 Application of Act. */
  applicationOfAct: ref('§2 Application of Act'),
  /** §3 Objects of Act: quality assurance, curriculum control, certificates. */
  objects: ref('§3 Objects of Act'),
  /** §4 Establishment of the Council (Umalusi). */
  establishmentOfCouncil: ref('§4 Establishment of Council (Umalusi)'),
  /** §5 Accreditation as Education and Training Quality Assurance Body. */
  accreditation: ref('§5 Accreditation as Education and Training Quality Assurance Body'),
  /** §16 Functions of the Council: quality assurance, curriculum and assessment standards. */
  functionsOfCouncil: ref('§16 Functions of Council'),
  /** §17 Internal assessment that forms part of final assessment. */
  internalAssessment: ref('§17 Internal assessment that forms part of final assessment'),
  /** §17A External assessment. */
  externalAssessment: ref('§17A External assessment'),
  /** §18 Functions of assessment body with regard to external assessment. */
  assessmentBodyFunctions: ref(
    '§18 Functions of assessment body with regard to external assessment',
  ),
  /** §23 Quality assurance of private education institutions. */
  privateInstitutionQA: ref('§23 Quality assurance of private education institutions'),
} as const;

export const GENFETQA_2001_METADATA: PolicyDocMetadata = {
  documentId: GENFETQA_2001_DOC_ID,
  documentVersion: GENFETQA_2001_VERSION,
  title:
    'General and Further Education and Training Quality Assurance Act, No. 58 of 2001',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'ACT',
  gazetteRef: 'Government Gazette 34620, 19 September 2011 (consolidated)',
  dateAssented: '2001-11-29',
  ratifiedBy: null,
};
