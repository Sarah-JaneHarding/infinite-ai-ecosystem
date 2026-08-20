// Shared types for Stage 29 curriculum L0 seeder.
//
// `CapsSourceInfo` is the normalised descriptor we build for every CAPS source document
// before submitting it to L0. Each CAPS source file in @infinite-ai/contracts exports its
// data under its own naming convention (CAPS_MATHS_IP_CONTENT_AREAS, CAPS_ENG_HL_IP_TOPIC_
// PROGRESSIONS, etc.); the adapter in `all-caps-sources.ts` maps each file's constants into
// this common shape, isolating the per-file divergence behind one boundary.
//
// `CapsCanonContent` and `AtpCalendarContent` are what the Brain actually stores in L0.
// They are richer than the raw source constants: every field carries the `SourceRef` it
// came from, so the provenance chain that `explain()` requires is unbroken from the
// earliest L0 write.

import { z } from 'zod';

import type { SourceRef } from '@infinite-ai/contracts';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class CurriculumSeedError extends Error {
  public override readonly name = 'CurriculumSeedError';
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// CAPS source descriptor
// ---------------------------------------------------------------------------

/** What we know about a CAPS document before submitting it to L0. */
export interface CapsSourceInfo {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly subject: string;
  readonly phase: 'FOUNDATION' | 'INTERMEDIATE' | 'SENIOR';
  /** Grade labels this document covers — e.g. ['R','1','2','3'] for FP, ['4','5','6'] for IP. */
  readonly grades: readonly string[];
  /** Content area names drawn directly from the source file — not invented. */
  readonly contentAreas: readonly string[];
  /** Content-area weightings per grade, where the source states them. */
  readonly weightings: readonly CapsWeightingEntry[];
  /** Total topic entry count across all grades; informational. */
  readonly topicCount: number;
  /** Provenance back to the CAPS source file. `ratifiedBy` is null — human countersigns. */
  readonly source: SourceRef;
}

export interface CapsWeightingEntry {
  readonly contentArea: string;
  readonly grade: string;
  readonly weightingPercent: number;
  /** The clause in the CAPS document where this weighting is stated. */
  readonly clause: string;
}

// ---------------------------------------------------------------------------
// L0 payload types
// ---------------------------------------------------------------------------

/**
 * What is written to L0 content for a `CAPS_CANON` constitution record.
 *
 * Zod schema so the read path can validate what it retrieves — the same
 * "unknown + Zod parse" discipline as `TemplateDefinition` in `curriculum-templates.ts`.
 */
export const CapsCanonContent = z.object({
  documentId: z.string().min(1),
  documentVersion: z.string().min(1),
  title: z.string().min(1),
  subject: z.string().min(1),
  phase: z.enum(['FOUNDATION', 'INTERMEDIATE', 'SENIOR']),
  grades: z.array(z.string().min(1)).min(1),
  contentAreas: z.array(z.string().min(1)).min(1),
  weightings: z.array(
    z.object({
      contentArea: z.string().min(1),
      grade: z.string().min(1),
      weightingPercent: z.number().min(0).max(100),
      clause: z.string().min(1),
    }),
  ),
  topicCount: z.number().int().nonnegative(),
  source: z.object({
    documentId: z.string().min(1),
    documentVersion: z.string().min(1),
    clause: z.string().min(1),
    ratifiedBy: z.string().nullable(),
  }),
});
export type CapsCanonContent = z.infer<typeof CapsCanonContent>;

/**
 * What is written to L0 content for an `ATP_CALENDAR` constitution record.
 *
 * Topic blocks are stored as a summary per term — the full descriptions are too large for
 * reliable vector retrieval and are recovered from the source file constants on demand.
 */
export const AtpCalendarContent = z.object({
  documentId: z.string().min(1),
  sourceId: z.string().min(1),
  grade: z.string().min(1),
  phase: z.string().min(1),
  subject: z.string().min(1),
  atpYear: z.number().int().positive(),
  sourceDescription: z.string().min(1),
  topicCount: z.number().int().nonnegative(),
  fatCount: z.number().int().nonnegative(),
  /** One entry per topic block: term, week range, content area, topic name. */
  topics: z.array(
    z.object({
      term: z.number().int().min(1).max(4),
      weekStart: z.number().int().positive(),
      weekEnd: z.number().int().positive(),
      contentArea: z.string().min(1),
      topic: z.string().min(1),
      assessmentType: z.string().nullable(),
    }),
  ),
  /** FAT schedule summary. */
  fats: z.array(
    z.object({
      term: z.number().int().min(1).max(4),
      fatNumber: z.number().int().nullable(),
      fatType: z.string().min(1),
      fatDescription: z.string().nullable(),
    }),
  ),
  source: z.object({
    documentId: z.string().min(1),
    documentVersion: z.string().min(1),
    clause: z.string().min(1),
    ratifiedBy: z.string().nullable(),
  }),
});
export type AtpCalendarContent = z.infer<typeof AtpCalendarContent>;

// ---------------------------------------------------------------------------
// Seed result
// ---------------------------------------------------------------------------

export interface SeedResult {
  readonly capsSubmitted: number;
  readonly atpSubmitted: number;
  /** Candidate IDs returned by `remember()`, one per submitted document. */
  readonly candidateIds: readonly string[];
}
