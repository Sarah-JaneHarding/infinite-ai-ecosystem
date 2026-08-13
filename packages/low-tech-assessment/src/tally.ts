// Response tallying — Stage 23.
// Accumulates scan results for one question and computes per-option counts,
// participation rate, and correctness breakdown.

import { z } from 'zod';

import { CardSide, type ScanResult } from './cards.js';
import { type Question } from './session.js';

// ─── Per-question tally schema ────────────────────────────────────────────────

/** Counts for a single answer option. */
export const OptionTally = z.object({
  side: CardSide,
  text: z.string(),
  count: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
});
export type OptionTally = z.infer<typeof OptionTally>;

/** Full tally for one question. */
export const QuestionTally = z.object({
  questionId: z.string(),
  questionText: z.string(),
  classSize: z.number().int().min(1),
  options: z.array(OptionTally),
  /** Number of cards scanned (responded). */
  responded: z.number().int().nonnegative(),
  /** Number of correct responses. */
  correct: z.number().int().nonnegative(),
  /** responded / classSize, expressed as 0–1. */
  participationRate: z.number().min(0).max(1),
  /** correct / responded, expressed as 0–1. 0 when no one responded. */
  correctRate: z.number().min(0).max(1),
});
export type QuestionTally = z.infer<typeof QuestionTally>;

// ─── Session result schema ────────────────────────────────────────────────────

/** Aggregated result across all questions in a session. */
export const SessionResult = z.object({
  sessionId: z.string(),
  title: z.string(),
  classSize: z.number().int().min(1),
  questionTallies: z.array(QuestionTally),
  /** Mean correctRate across all questions. */
  overallCorrectRate: z.number().min(0).max(1),
});
export type SessionResult = z.infer<typeof SessionResult>;

// ─── Tally functions ──────────────────────────────────────────────────────────

/**
 * Tallies scan results for a single question.
 *
 * Duplicate card numbers in `scans` (e.g. a card scanned twice) are deduplicated
 * by keeping the last scan — matching how real Plickers-style apps handle re-scans.
 */
export function tallyQuestion(
  question: Question,
  scans: readonly ScanResult[],
  classSize: number,
): QuestionTally {
  // Deduplicate: last scan wins.
  const latest = new Map<number, ScanResult>();
  for (const scan of scans) {
    latest.set(scan.cardNumber, scan);
  }
  const deduped = [...latest.values()];

  const counts = new Map<CardSide, number>();
  for (const scan of deduped) {
    counts.set(scan.side, (counts.get(scan.side) ?? 0) + 1);
  }

  const options: OptionTally[] = question.options.map((opt) =>
    OptionTally.parse({
      side: opt.side,
      text: opt.text,
      count: counts.get(opt.side) ?? 0,
      isCorrect: opt.side === question.correctSide,
    }),
  );

  const responded = deduped.length;
  const correct = counts.get(question.correctSide) ?? 0;

  return QuestionTally.parse({
    questionId: question.id,
    questionText: question.text,
    classSize,
    options,
    responded,
    correct,
    participationRate: classSize > 0 ? responded / classSize : 0,
    correctRate: responded > 0 ? correct / responded : 0,
  });
}

/**
 * Computes session-level results by tallying each question in order.
 *
 * `scansByQuestion` is a map from questionId to the scans collected during
 * that question. Questions with no entry are treated as having no responses.
 */
export function tallySession(
  sessionId: string,
  title: string,
  classSize: number,
  questions: readonly Question[],
  scansByQuestion: ReadonlyMap<string, readonly ScanResult[]>,
): SessionResult {
  const questionTallies = questions.map((q) =>
    tallyQuestion(q, scansByQuestion.get(q.id) ?? [], classSize),
  );

  const overallCorrectRate =
    questionTallies.length === 0
      ? 0
      : questionTallies.reduce((sum, t) => sum + t.correctRate, 0) /
        questionTallies.length;

  return SessionResult.parse({
    sessionId,
    title,
    classSize,
    questionTallies,
    overallCorrectRate,
  });
}

/**
 * Returns the cards that have not yet been scanned for a given question,
 * given a set of card numbers issued (1..classSize) and the scans so far.
 */
export function unscannedCards(
  classSize: number,
  scans: readonly ScanResult[],
): readonly number[] {
  const scanned = new Set(scans.map((s) => s.cardNumber));
  return Array.from({ length: classSize }, (_, i) => i + 1).filter(
    (n) => !scanned.has(n),
  );
}
