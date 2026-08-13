import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The version supplied is the consolidated text updated to Government Gazette 34620
// dated 19 September 2011 (incorporating amendments through BELA Act 15 of 2011).
export const NEPA_1996_DOC_ID = 'nepa-27-of-1996' as const;
export const NEPA_1996_VERSION = '2011-09-19' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: NEPA_1996_DOC_ID,
    documentVersion: NEPA_1996_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const NEPA_1996_SECTIONS = {
  /** §1 Definitions: Council, Committee, educator, Minister, school. */
  definitions: ref('§1 Definitions'),
  /** §2 Objectives of Act: policy determination, consultation, publication, monitoring. */
  objectives: ref('§2 Objectives of Act'),
  /** §3 Determination of national education policy by Minister. */
  policyDetermination: ref('§3 Determination of national education policy by Minister'),
  /** §4 Directive principles of national education policy. */
  directivePrinciples: ref('§4 Directive principles of national education policy'),
  /** §5 Consultation procedure before policy determination. */
  consultationProcedure: ref('§5 Consultation on national education policy'),
  /** §7 Publication of national education policy — gazette requirement. */
  policyPublication: ref('§7 Publication of national education policy'),
  /** §8 Monitoring and evaluation of education. */
  monitoringAndEvaluation: ref('§8 Monitoring and evaluation of education'),
  /** §9 Council of Education Ministers (CEM) — composition and functions. */
  councilOfEducationMinisters: ref(
    '§9 Council of Education Ministers — composition and functions',
  ),
  /** §10 Heads of Education Departments Committee (HEDCOM). */
  hedcom: ref('§10 Heads of Education Departments Committee (HEDCOM)'),
} as const;

export const NEPA_1996_METADATA: PolicyDocMetadata = {
  documentId: NEPA_1996_DOC_ID,
  documentVersion: NEPA_1996_VERSION,
  title: 'National Education Policy Act, No. 27 of 1996',
  publisher: 'Parliament of the Republic of South Africa',
  kind: 'ACT',
  gazetteRef: 'Government Gazette 34620, 19 September 2011 (consolidated)',
  dateAssented: '1996-04-16',
  ratifiedBy: null,
};
