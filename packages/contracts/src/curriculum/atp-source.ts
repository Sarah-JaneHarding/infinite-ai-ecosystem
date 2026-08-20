// Raw ATP source data types — ingested from DBE Annual Teaching Plans.
//
// These types carry derived structural data only (topic names, content areas, week ranges,
// assessment types). No source text from the ATP documents is stored here — OQ-005 covers
// the approved-text gap; this file is the mechanism, not the content.
//
// The three phase source files (`atp-fp-gr-r3.ts`, `atp-ip-gr46.ts`, `atp-sp-gr7.ts`)
// export arrays of `ATPSourceDocument`; the CE-02 agent reads those arrays from L0 when
// constructing a per-school `ATPSchedule`.

import type { SourceRef } from './framework.js';

/** One topic-block row from a DBE ATP document. Maps to one `atp_topics` row. */
export interface ATPTopicBlock {
  readonly sourceId: string;
  readonly grade: string;
  readonly subject: string;
  readonly term: 1 | 2 | 3 | 4;
  readonly weekStart: number;
  readonly weekEnd: number;
  readonly contentArea: string;
  /** Topic name only — not the concepts/skills description text (OQ-005). */
  readonly topic: string;
  /** FAT type when this block is an assessment block ('Test', 'Project', etc.), else null. */
  readonly assessmentType: string | null;
  readonly hours: number | null;
  readonly basis: SourceRef;
}

/** One FAT (Formal Assessment Task) schedule row. Maps to one `fat_schedule` row. */
export interface ATPFatRow {
  readonly sourceId: string;
  readonly grade: string;
  readonly subject: string;
  readonly term: 1 | 2 | 3 | 4;
  readonly fatNumber: number | null;
  /** FAT kind: 'Test', 'Project', 'Examination', 'Assignment', 'Oral', 'Practical', etc. */
  readonly fatType: string;
  /** DBE description of what the FAT covers — brief label, not full rubric text. */
  readonly fatDescription: string | null;
  readonly weekNumber: number | null;
  readonly durationHours: number | null;
  readonly markTotal: number | null;
  readonly sbaContribution: string | null;
  readonly basis: SourceRef;
}

/**
 * All structural data extracted from one DBE ATP source document.
 *
 * `atpYear` is the year of the published plan (2023 or 2026). DBE Circular S19 of 2025
 * confirms 2023/24 ATPs remain in force until further notice; 2026 ATPs are loaded for
 * Grade 4–5 Mathematics, Grades 4–6 NS&T, and Grade 7 Natural Sciences.
 */
export interface ATPSourceDocument {
  readonly sourceId: string;
  readonly grade: string;
  readonly phase: string;
  readonly subject: string;
  readonly atpYear: number;
  readonly sourceDescription: string;
  readonly topics: readonly ATPTopicBlock[];
  readonly fats: readonly ATPFatRow[];
}
