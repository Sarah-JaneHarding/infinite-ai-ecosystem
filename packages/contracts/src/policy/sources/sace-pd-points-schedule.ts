import { z } from 'zod';

import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

// The SACE PD Points Schedule carries no visible publication date on any page supplied.
// Version is recorded as 'undated' per the ingestion rule: never invent a date.
export const SACE_PD_POINTS_SCHEDULE_DOC_ID = 'sace-pd-points-schedule' as const;
export const SACE_PD_POINTS_SCHEDULE_VERSION = 'undated' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: SACE_PD_POINTS_SCHEDULE_DOC_ID,
    documentVersion: SACE_PD_POINTS_SCHEDULE_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

/** Total PD Points required per three-year CPTD cycle, per p.2 of the schedule. */
export const SACE_CPTD_TOTAL_PD_POINTS = 150 as const;
/** Duration of the CPTD cycle in years, per p.2 of the schedule. */
export const SACE_CPTD_CYCLE_YEARS = 3 as const;

export const SacePdActivityType = z.enum([
  'TYPE_1_TEACHER_INITIATED',
  'TYPE_2_SCHOOL_INITIATED',
  'TYPE_3_EXTERNALLY_INITIATED',
]);
export type SacePdActivityType = z.infer<typeof SacePdActivityType>;

export const SACE_PD_POINTS_SCHEDULE_SECTIONS = {
  /** Core requirement: 150 PD Points per 3-year CPTD cycle across all three types. */
  totalPointsRequirement: ref(
    'Total PD Points requirement — 150 points per 3-year CPTD cycle',
    2,
  ),
  /** Type 1 (Teacher-Initiated) activities and their pre-determined point values. */
  type1Activities: ref(
    'Type 1 (Teacher-Initiated) PD Activities — pre-determined point table',
    4,
  ),
  /** Type 2 (School-Initiated) activities — reported by the school on the teacher's behalf. */
  type2Activities: ref(
    'Type 2 (School-Initiated) PD Activities — school reports on teacher behalf',
    3,
  ),
  /** Type 3 (Externally-Initiated) activities — endorsed by SACE, reported by provider. */
  type3Activities: ref(
    'Type 3 (Externally-Initiated) PD Activities — SACE-endorsed, provider reports',
    3,
  ),
  /** Recording participation: Type 1 in PDP, Type 2 school-reported, Type 3 provider-reported. */
  recordingParticipation: ref(
    'Recording and Reporting Participation in PD Activities',
    3,
  ),
} as const;

export const SACE_PD_POINTS_SCHEDULE_METADATA: PolicyDocMetadata = {
  documentId: SACE_PD_POINTS_SCHEDULE_DOC_ID,
  documentVersion: SACE_PD_POINTS_SCHEDULE_VERSION,
  title: 'Professional Development Points Schedule',
  publisher: 'South African Council for Educators (SACE)',
  kind: 'SCHEDULE',
  ratifiedBy: null,
};
