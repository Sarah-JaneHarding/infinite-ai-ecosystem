import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The version supplied (b162058b-SASA_as_amended_by_BELA2024.pdf) is the consolidated
// SASA text updated to Government Gazette 51836 dated 24 December 2024 — the version
// that incorporates BELA Act 32 of 2024 in full.
export const SASA_1996_DOC_ID = 'sasa-84-of-1996' as const;
export const SASA_1996_VERSION = '2024-12-24' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: SASA_1996_DOC_ID,
    documentVersion: SASA_1996_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const SASA_1996_SECTIONS = {
  /** §1 Definitions: learner, educator, parent, school, governing body, etc. */
  definitions: ref('§1 Definitions'),
  /** §3 Compulsory attendance (now includes Grade R by virtue of BELA 32/2024). */
  compulsoryAttendance: ref('§3 Compulsory attendance'),
  /** §4 Exemption from compulsory attendance. */
  exemptionFromAttendance: ref('§4 Exemption from compulsory attendance'),
  /** §5 Admission to public schools. */
  admission: ref('§5 Admission to public schools'),
  /** §6 Language policy of public schools. */
  languagePolicy: ref('§6 Language policy of public schools'),
  /** §6A Curriculum and assessment (inserted by BELA 32/2024). */
  curriculumAndAssessment: ref('§6A Curriculum and assessment'),
  /** §8 Code of conduct for learners. */
  codeOfConduct: ref('§8 Code of conduct'),
  /** §9 Suspension and expulsion from public school. */
  suspensionExpulsion: ref('§9 Suspension and expulsion from public school'),
  /** §10 Prohibition of corporal punishment. */
  corporalPunishmentProhibition: ref('§10 Prohibition of corporal punishment'),
  /** §20 Functions of all governing bodies. */
  governingBodyFunctions: ref('§20 Functions of all governing bodies'),
  /** §21 Allocated functions of governing bodies. */
  governingBodyAllocatedFunctions: ref('§21 Allocated functions of governing bodies'),
  /** §33 Closure of public schools. */
  schoolClosure: ref('§33 Closure of public schools'),
  /** §39 School fees at public schools. */
  schoolFees: ref('§39 School fees at public schools'),
  /** §40 Parent's liability for payment of school fees. */
  parentSchoolFeeliability: ref("§40 Parent's liability for payment of school fees"),
} as const;

export const SASA_1996_METADATA: PolicyDocMetadata = {
  documentId: SASA_1996_DOC_ID,
  documentVersion: SASA_1996_VERSION,
  title:
    'South African Schools Act, No. 84 of 1996 (as amended by Basic Education Laws Amendment Act, No. 32 of 2024)',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'ACT',
  gazetteRef:
    'Government Gazette No. 51836, 24 December 2024 (incorporating BELA Act 32/2024)',
  dateAssented: '1996-11-06',
  ratifiedBy: null,
};
