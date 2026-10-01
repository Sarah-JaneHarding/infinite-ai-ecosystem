// Teacher Studio → Curriculum Map: turns ratified L0 `ATP_CALENDAR` constitution rows
// into what the screen shows.
//
// Pure and synchronous on purpose — no database, no I/O — so every rule below is cheap to
// test. The database read lives in `atp-curriculum-loader.ts`.
//
// What this does NOT do, deliberately:
//  - It invents nothing. An ATP row holds pacing (term, weeks, topic, content area,
//    assessment type) and formal assessment tasks. It does NOT hold learning intentions,
//    success criteria, activities or resources; those belong to lesson plans, so this view
//    has no field for them rather than a made-up one.
//  - It does not choose between ATP years. When one grade and subject has plans from more
//    than one year (e.g. Grade 1 Mathematics: 2023 and 2026), which one applies is a
//    curriculum-policy decision (CLAUDE.md: never invent curriculum policy), so each year
//    is returned as its own group.
//  - It does not trust the stored JSON. Rule 8: `unknown` plus a Zod parse. A row that does
//    not parse is skipped and counted, never rendered half-understood.

import { z } from 'zod';

const TermSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/** The subset of `ATPTopicBlock` (@infinite-ai/contracts) that is stored in L0. */
const StoredTopicSchema = z.object({
  term: TermSchema,
  topic: z.string().min(1),
  weekStart: z.number().int().positive(),
  weekEnd: z.number().int().positive(),
  contentArea: z.string(),
  assessmentType: z.string().nullable().optional(),
});

/** The subset of `ATPFatRow` (@infinite-ai/contracts) that is stored in L0. */
const StoredFatSchema = z.object({
  term: TermSchema,
  fatType: z.string(),
  fatNumber: z.number().int().nullable().optional(),
  fatDescription: z.string().nullable().optional(),
});

const StoredAtpSchema = z.object({
  grade: z.string().min(1),
  subject: z.string().min(1),
  atpYear: z.number().int(),
  sourceDescription: z.string(),
  documentId: z.string().min(1),
  source: z.object({ documentVersion: z.string() }).optional(),
  topics: z.array(StoredTopicSchema),
  fats: z.array(StoredFatSchema).default([]),
});

export type Term = z.infer<typeof TermSchema>;

export interface AtpTopicRow {
  readonly term: Term;
  readonly weekStart: number;
  readonly weekEnd: number;
  readonly topic: string;
  readonly contentArea: string;
  /** FAT kind when the block is an assessment block, otherwise null. */
  readonly assessmentType: string | null;
}

export interface AtpFatTask {
  readonly term: Term;
  readonly fatNumber: number | null;
  readonly fatType: string;
  readonly fatDescription: string | null;
}

export interface AtpSourceRef {
  readonly documentId: string;
  readonly documentVersion: string | null;
  readonly description: string;
}

/** One parsed ATP document, still keyed by grade and subject. */
export interface AtpDocument {
  readonly grade: string;
  readonly subject: string;
  readonly atpYear: number;
  readonly source: AtpSourceRef;
  readonly topics: readonly AtpTopicRow[];
  readonly fats: readonly AtpFatTask[];
}

/** A row as read from `brain_constitution`; `content` is untrusted JSON. */
export interface ConstitutionRowInput {
  readonly kind: string;
  readonly content: unknown;
}

export interface ParsedAtp {
  readonly documents: readonly AtpDocument[];
  /** `ATP_CALENDAR` rows that did not match the expected shape and were left out. */
  readonly skipped: number;
}

export function parseAtpDocuments(rows: readonly ConstitutionRowInput[]): ParsedAtp {
  const documents: AtpDocument[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (row.kind !== 'ATP_CALENDAR') continue;
    const parsed = StoredAtpSchema.safeParse(row.content);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const doc = parsed.data;
    documents.push({
      grade: doc.grade,
      subject: doc.subject,
      atpYear: doc.atpYear,
      source: {
        documentId: doc.documentId,
        documentVersion: doc.source?.documentVersion ?? null,
        description: doc.sourceDescription,
      },
      topics: doc.topics.map((t) => ({
        term: t.term,
        weekStart: t.weekStart,
        weekEnd: t.weekEnd,
        topic: t.topic,
        contentArea: t.contentArea,
        assessmentType: t.assessmentType ?? null,
      })),
      fats: doc.fats.map((f) => ({
        term: f.term,
        fatNumber: f.fatNumber ?? null,
        fatType: f.fatType,
        fatDescription: f.fatDescription ?? null,
      })),
    });
  }

  return { documents, skipped };
}

// ── Grades ───────────────────────────────────────────────────────────────────

/** Grade R first, then numeric, then multi-grade documents ("4-6") after their start. */
function gradeSortKey(grade: string): number {
  if (grade === 'R') return -1;
  if (/^\d+$/.test(grade)) return Number(grade);
  const range = /^(\d+)-(\d+)$/.exec(grade);
  if (range) return Number(range[1]) + 0.5;
  return 1000;
}

export function compareGrades(a: string, b: string): number {
  return gradeSortKey(a) - gradeSortKey(b) || a.localeCompare(b);
}

export function gradeLabel(grade: string): string {
  if (/^\d+-\d+$/.test(grade)) return `Grades ${grade.replace('-', '–')}`;
  return `Grade ${grade}`;
}

// ── Catalogue (what can be chosen) ───────────────────────────────────────────

export interface Catalogue {
  readonly grades: readonly string[];
  readonly subjectsByGrade: Readonly<Record<string, readonly string[]>>;
}

export function buildCatalogue(documents: readonly AtpDocument[]): Catalogue {
  const byGrade = new Map<string, Set<string>>();
  for (const doc of documents) {
    const subjects = byGrade.get(doc.grade) ?? new Set<string>();
    subjects.add(doc.subject);
    byGrade.set(doc.grade, subjects);
  }
  const grades = [...byGrade.keys()].sort(compareGrades);
  const subjectsByGrade: Record<string, readonly string[]> = {};
  for (const grade of grades) {
    subjectsByGrade[grade] = [...(byGrade.get(grade) ?? [])].sort((a, b) =>
      a.localeCompare(b),
    );
  }
  return { grades, subjectsByGrade };
}

/**
 * Turns what was asked for (e.g. from the query string) into a grade and subject that
 * exist in the catalogue. Anything unknown falls back to the first available entry, so
 * untrusted input is never echoed back as a choice. `null` when there is no data at all.
 */
export function resolveSelection(
  catalogue: Catalogue,
  requestedGrade: string | undefined,
  requestedSubject: string | undefined,
): { readonly grade: string; readonly subject: string } | null {
  const firstGrade = catalogue.grades[0];
  if (firstGrade === undefined) return null;

  const grade =
    requestedGrade !== undefined && catalogue.grades.includes(requestedGrade)
      ? requestedGrade
      : firstGrade;
  const subjects = catalogue.subjectsByGrade[grade] ?? [];
  const subject =
    requestedSubject !== undefined && subjects.includes(requestedSubject)
      ? requestedSubject
      : subjects[0];
  if (subject === undefined) return null;

  return { grade, subject };
}

// ── The selected curriculum ──────────────────────────────────────────────────

export interface AtpYearGroup {
  readonly atpYear: number;
  readonly topics: readonly AtpTopicRow[];
  readonly fats: readonly AtpFatTask[];
  readonly sources: readonly AtpSourceRef[];
}

export function selectCurriculum(
  documents: readonly AtpDocument[],
  grade: string,
  subject: string,
): readonly AtpYearGroup[] {
  const years = new Map<number, AtpDocument[]>();
  for (const doc of documents) {
    if (doc.grade !== grade || doc.subject !== subject) continue;
    const bucket = years.get(doc.atpYear) ?? [];
    bucket.push(doc);
    years.set(doc.atpYear, bucket);
  }

  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([atpYear, docs]) => ({
      atpYear,
      topics: docs
        .flatMap((d) => d.topics)
        .sort((a, b) => a.term - b.term || a.weekStart - b.weekStart),
      fats: docs
        .flatMap((d) => d.fats)
        .sort((a, b) => a.term - b.term || (a.fatNumber ?? 0) - (b.fatNumber ?? 0)),
      sources: docs.map((d) => d.source),
    }));
}

export function formatWeeks(topic: { weekStart: number; weekEnd: number }): string {
  return topic.weekEnd > topic.weekStart
    ? `${topic.weekStart}–${topic.weekEnd}`
    : String(topic.weekStart);
}

/** Everything the Curriculum Map tab needs, in one serialisable value. */
export interface CurriculumMapData {
  readonly catalogue: Catalogue;
  readonly selection: { readonly grade: string; readonly subject: string } | null;
  readonly groups: readonly AtpYearGroup[];
  readonly skipped: number;
}

export function buildCurriculumMap(
  rows: readonly ConstitutionRowInput[],
  requestedGrade: string | undefined,
  requestedSubject: string | undefined,
): CurriculumMapData {
  const { documents, skipped } = parseAtpDocuments(rows);
  const catalogue = buildCatalogue(documents);
  const selection = resolveSelection(catalogue, requestedGrade, requestedSubject);
  const groups =
    selection === null
      ? []
      : selectCurriculum(documents, selection.grade, selection.subject);
  return { catalogue, selection, groups, skipped };
}
