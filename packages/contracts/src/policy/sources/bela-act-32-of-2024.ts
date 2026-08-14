import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const BELA_ACT_2024_DOC_ID = 'bela-act-32-of-2024' as const;
export const BELA_ACT_2024_VERSION = '2024-09-13' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: BELA_ACT_2024_DOC_ID,
    documentVersion: BELA_ACT_2024_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const BELA_ACT_2024_SECTIONS = {
  /** BELA amends SASA §3: Grade R attendance is now compulsory. */
  gradeRCompulsoryAttendance: ref(
    'BELA §1 amending SASA §3 — Grade R compulsory attendance',
  ),
  /** BELA amends SASA §6: language policy, South African Sign Language as official LoLT. */
  languagePolicy: ref(
    'BELA amending SASA §6 — Language policy, Sign Language as official LoLT',
  ),
  /** BELA inserts SASA §6A: curriculum and assessment advisory body. */
  curriculumAndAssessmentAdvisory: ref(
    'BELA inserting SASA §6A — Curriculum and assessment advisory body',
  ),
  /** BELA amends SASA §8: code of conduct must account for diverse cultural beliefs; exemption clause required. */
  codeOfConduct: ref(
    'BELA amending SASA §8 — Code of conduct: cultural/religious exemption clause',
  ),
  /** BELA amends SASA §9: suspension and expulsion — age-appropriate, best-interests standard. */
  suspensionExpulsion: ref(
    'BELA amending SASA §9 — Suspension and expulsion: age-appropriate proceedings',
  ),
  /** BELA amends SASA governing body provisions — HOD may dissolve non-functioning SGB. */
  governingBodyDissolution: ref(
    'BELA amending SASA §25 — HOD power to dissolve non-functioning governing body',
  ),
  /** BELA amends SASA §38A — prohibition on extra remuneration/benefit in kind to state employees. */
  remunerationProhibition: ref(
    'BELA inserting SASA §38A — Prohibition of unauthorised remuneration or benefit in kind',
  ),
  /** BELA prohibits corporal punishment explicitly; creates offence. */
  corporalPunishmentProhibition: ref(
    'BELA amending SASA §10 — Corporal punishment: explicit prohibition and offence',
  ),
} as const;

export const BELA_ACT_2024_METADATA: PolicyDocMetadata = {
  documentId: BELA_ACT_2024_DOC_ID,
  documentVersion: BELA_ACT_2024_VERSION,
  title: 'Basic Education Laws Amendment Act, 2024 (Act No. 32 of 2024)',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'AMENDMENT_ACT',
  gazetteRef: 'Government Gazette Vol. 711, No. 51258, 16 September 2024',
  dateAssented: '2024-09-13',
  ratifiedBy: null,
};
