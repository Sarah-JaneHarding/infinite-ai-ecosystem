// Quiz session schema — Stage 23.
// A session is one classroom assessment event: a set of questions, each with
// 2–4 multiple-choice options, one of which is correct.

import { z } from 'zod';

import { CardSide, MAX_CARDS } from './cards.js';

// ─── Question schema ──────────────────────────────────────────────────────────

/** One answer option within a question. */
export const AnswerOption = z.object({
  side: CardSide,
  text: z.string().min(1),
});
export type AnswerOption = z.infer<typeof AnswerOption>;

/**
 * A single quiz question.
 * options must have 2–4 entries with distinct sides.
 * correctSide must be one of the option sides.
 */
export const Question = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    options: z.array(AnswerOption).min(2).max(4),
    correctSide: CardSide,
  })
  .refine((q) => q.options.some((o) => o.side === q.correctSide), {
    message: 'correctSide must match one of the option sides',
  })
  .refine(
    (q) => {
      const sides = q.options.map((o) => o.side);
      return new Set(sides).size === sides.length;
    },
    { message: 'option sides must be distinct' },
  );
export type Question = z.infer<typeof Question>;

// ─── Session schema ───────────────────────────────────────────────────────────

export const SessionStatus = z.enum(['pending', 'active', 'closed']);
export type SessionStatus = z.infer<typeof SessionStatus>;

/**
 * A classroom assessment session.
 * classSize is the number of cards issued (1–MAX_CARDS).
 */
export const AssessmentSession = z.object({
  sessionId: z.string().min(1),
  /** Educator's display name for this session (e.g. "Grade 5 Maths – Term 2"). */
  title: z.string().min(1),
  classSize: z.number().int().min(1).max(MAX_CARDS),
  questions: z.array(Question).min(1),
  status: SessionStatus.default('pending'),
  /** Index of the question currently being asked (0-based). null when not active. */
  currentQuestionIndex: z.number().int().min(0).nullable().default(null),
  /** ISO-8601 UTC timestamp of session creation. */
  createdAt: z.string().datetime(),
});
export type AssessmentSession = z.infer<typeof AssessmentSession>;

// ─── Session lifecycle ────────────────────────────────────────────────────────

/**
 * Transitions a pending session to active and starts on question 0.
 */
export function startSession(session: AssessmentSession): AssessmentSession {
  if (session.status !== 'pending') {
    throw new Error(`Cannot start a session that is already ${session.status}`);
  }
  return { ...session, status: 'active', currentQuestionIndex: 0 };
}

/**
 * Advances to the next question.
 * Throws if there is no next question — call closeSession instead.
 */
export function advanceQuestion(session: AssessmentSession): AssessmentSession {
  if (session.status !== 'active') {
    throw new Error('Session must be active to advance');
  }
  const next = (session.currentQuestionIndex ?? 0) + 1;
  if (next >= session.questions.length) {
    throw new Error('No more questions — close the session instead');
  }
  return { ...session, currentQuestionIndex: next };
}

/**
 * Closes an active session.
 */
export function closeSession(session: AssessmentSession): AssessmentSession {
  if (session.status !== 'active') {
    throw new Error('Only an active session can be closed');
  }
  return { ...session, status: 'closed', currentQuestionIndex: null };
}

/**
 * Returns the question currently on display, or undefined when not active.
 */
export function currentQuestion(session: AssessmentSession): Question | undefined {
  if (session.currentQuestionIndex === null) return undefined;
  return session.questions[session.currentQuestionIndex];
}
