import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The version supplied is the consolidated text updated to Government Gazette 34620
// dated 19 September 2011 (incorporating amendments through BELA Act 15 of 2011).
export const SACE_ACT_2000_DOC_ID = 'sace-act-31-of-2000' as const;
export const SACE_ACT_2000_VERSION = '2011-09-19' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: SACE_ACT_2000_DOC_ID,
    documentVersion: SACE_ACT_2000_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const SACE_ACT_2000_SECTIONS = {
  /** §1 Definitions: council, educator, institution, school. */
  definitions: ref('§1 Definitions'),
  /** §2 Objects of Act: registration, professional development, ethical standards. */
  objects: ref('§2 Objects of Act'),
  /** §3 Application of Act. */
  applicationOfAct: ref('§3 Application of Act'),
  /** §4 Continuation of council (SACE as juristic person). */
  continuationOfCouncil: ref('§4 Continuation of council as juristic person'),
  /**
   * §5 Powers and duties of council — includes educator registration,
   * professional development (CPTD), ethics, and disciplinary functions.
   */
  powersAndDuties: ref('§5 Powers and duties of council (including CPTD)'),
  /** §12 Registration committee — SACE's registration body. */
  registrationCommittee: ref('§12 Registration committee'),
  /** §13 Professional development committee. */
  professionalDevelopmentCommittee: ref('§13 Professional development committee'),
  /** §14 Disciplinary committee. */
  disciplinaryCommittee: ref('§14 Disciplinary committee'),
  /** §21 Compulsory registration of educators. */
  compulsoryRegistration: ref('§21 Compulsory registration of educators'),
  /** §22 Application for registration. */
  registrationApplication: ref('§22 Application for registration'),
  /** §23 Removal from register: grounds for deregistration. */
  removalFromRegister: ref('§23 Removal of name from register'),
} as const;

export const SACE_ACT_2000_METADATA: PolicyDocMetadata = {
  documentId: SACE_ACT_2000_DOC_ID,
  documentVersion: SACE_ACT_2000_VERSION,
  title: 'South African Council for Educators Act, No. 31 of 2000',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'ACT',
  gazetteRef: 'Government Gazette 34620, 19 September 2011 (consolidated)',
  dateAssented: '2000-07-26',
  ratifiedBy: null,
};
