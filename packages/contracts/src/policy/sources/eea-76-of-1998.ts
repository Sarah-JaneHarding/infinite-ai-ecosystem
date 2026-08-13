import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The version supplied is the consolidated text updated to Government Gazette 34620
// dated 19 September 2011 (incorporating amendments through BELA Act 15 of 2011).
export const EEA_1998_DOC_ID = 'eea-76-of-1998' as const;
export const EEA_1998_VERSION = '2011-09-19' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: EEA_1998_DOC_ID,
    documentVersion: EEA_1998_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const EEA_1998_SECTIONS = {
  /** §1 Definitions: educator, employer, departmental office. */
  definitions: ref('§1 Definitions'),
  /** §2 Application of Act. */
  applicationOfAct: ref('§2 Application of Act'),
  /** §3 Employers of educators and other persons. */
  employers: ref('§3 Employers of educators and other persons'),
  /** §4 Salaries and other conditions of service of educators. */
  salariesAndConditions: ref('§4 Salaries and other conditions of service of educators'),
  /** §6 Powers of employers regarding appointments. */
  appointmentPowers: ref('§6 Powers of employers regarding appointments'),
  /** §11 Discharge of educators. */
  discharge: ref('§11 Discharge of educators'),
  /** §16 Incapacity: poor work performance procedures. */
  incapacity: ref('§16 Incapacity — poor work performance'),
  /** §17 Serious misconduct: enumerated grounds and process. */
  seriousMisconduct: ref('§17 Serious misconduct'),
  /** §18 Misconduct: general. */
  misconduct: ref('§18 Misconduct'),
  /** §25 Appeals against disciplinary decisions. */
  appeals: ref('§25 Appeals'),
  /** §26 Furnishing SACE with records of disciplinary proceedings. */
  saceRecords: ref('§26 Furnishing SACE with records of disciplinary proceedings'),
} as const;

export const EEA_1998_METADATA: PolicyDocMetadata = {
  documentId: EEA_1998_DOC_ID,
  documentVersion: EEA_1998_VERSION,
  title: 'Employment of Educators Act, No. 76 of 1998',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'ACT',
  gazetteRef: 'Government Gazette 34620, 19 September 2011 (consolidated)',
  dateAssented: '1998-09-30',
  ratifiedBy: null,
};
