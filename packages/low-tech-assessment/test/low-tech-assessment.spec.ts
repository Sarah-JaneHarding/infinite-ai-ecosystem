// Unit tests — Stage 23 (Low-Tech Assessment).
// Happy path + at least two failure paths per area.

import { describe, expect, it } from 'vitest';

import {
  AssessmentSession,
  Card,
  CardSide,
  MAX_CARDS,
  Question,
  ScanResult,
  advanceQuestion,
  closeSession,
  currentQuestion,
  findCard,
  generateCardSet,
  startSession,
  tallyQuestion,
  tallySession,
  unscannedCards,
} from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = '2026-08-13T10:00:00Z';

function makeQuestion(id: string, correctSide: CardSide = 'A'): Question {
  return Question.parse({
    id,
    text: `Question ${id}`,
    options: [
      { side: 'A', text: 'Option A' },
      { side: 'B', text: 'Option B' },
      { side: 'C', text: 'Option C' },
      { side: 'D', text: 'Option D' },
    ],
    correctSide,
  });
}

function makeSession(overrides?: Partial<AssessmentSession>): AssessmentSession {
  return AssessmentSession.parse({
    sessionId: 'sess-001',
    title: 'Grade 5 Maths – Term 2',
    classSize: 5,
    questions: [makeQuestion('q1', 'A'), makeQuestion('q2', 'B')],
    status: 'pending',
    currentQuestionIndex: null,
    createdAt: NOW,
    ...overrides,
  });
}

function makeScan(cardNumber: number, side: CardSide): ScanResult {
  return ScanResult.parse({ cardNumber, side });
}

// ─── cards.ts — generateCardSet ───────────────────────────────────────────────

describe('generateCardSet', () => {
  it('generates the requested number of cards', () => {
    const cards = generateCardSet(30);
    expect(cards).toHaveLength(30);
  });

  it('card numbers are 1-indexed and sequential', () => {
    const cards = generateCardSet(5);
    expect(cards.map((c) => c.cardNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('card codes have the expected prefix', () => {
    const cards = generateCardSet(3);
    expect(cards[0]?.code).toBe('LTA-01');
    expect(cards[1]?.code).toBe('LTA-02');
    expect(cards[2]?.code).toBe('LTA-03');
  });

  it('slot labels are zero-padded', () => {
    const cards = generateCardSet(10);
    expect(cards[0]?.slotLabel).toBe('01');
    expect(cards[9]?.slotLabel).toBe('10');
  });

  it('generates up to MAX_CARDS without error', () => {
    const cards = generateCardSet(MAX_CARDS);
    expect(cards).toHaveLength(MAX_CARDS);
  });

  it('throws for count = 0', () => {
    expect(() => generateCardSet(0)).toThrow(RangeError);
  });

  it('throws for count > MAX_CARDS', () => {
    expect(() => generateCardSet(MAX_CARDS + 1)).toThrow(RangeError);
  });

  it('throws for non-integer count', () => {
    expect(() => generateCardSet(2.5)).toThrow(RangeError);
  });
});

describe('findCard', () => {
  it('returns the card for a known cardNumber', () => {
    const cards = generateCardSet(10);
    const found = findCard(cards, 5);
    expect(found?.cardNumber).toBe(5);
    expect(found?.code).toBe('LTA-05');
  });

  it('returns undefined for an unknown cardNumber', () => {
    const cards = generateCardSet(5);
    expect(findCard(cards, 99)).toBeUndefined();
  });
});

// ─── cards.ts — CardSide schema ───────────────────────────────────────────────

describe('CardSide schema', () => {
  it('accepts A B C D', () => {
    for (const side of ['A', 'B', 'C', 'D'] as const) {
      expect(CardSide.parse(side)).toBe(side);
    }
  });

  it('rejects an invalid side', () => {
    expect(CardSide.safeParse('E').success).toBe(false);
  });
});

// ─── cards.ts — Card schema ───────────────────────────────────────────────────

describe('Card schema', () => {
  it('rejects cardNumber = 0', () => {
    expect(
      Card.safeParse({ cardNumber: 0, slotLabel: '00', code: 'LTA-00' }).success,
    ).toBe(false);
  });

  it('rejects cardNumber > MAX_CARDS', () => {
    expect(
      Card.safeParse({ cardNumber: MAX_CARDS + 1, slotLabel: '99', code: 'LTA-99' })
        .success,
    ).toBe(false);
  });
});

// ─── session.ts — Question schema ─────────────────────────────────────────────

describe('Question schema', () => {
  it('parses a valid 4-option question', () => {
    const result = Question.safeParse({
      id: 'q1',
      text: 'What is 2+2?',
      options: [
        { side: 'A', text: '3' },
        { side: 'B', text: '4' },
        { side: 'C', text: '5' },
        { side: 'D', text: '6' },
      ],
      correctSide: 'B',
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid 2-option question', () => {
    const result = Question.safeParse({
      id: 'q2',
      text: 'True or false?',
      options: [
        { side: 'A', text: 'True' },
        { side: 'B', text: 'False' },
      ],
      correctSide: 'A',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when correctSide is not among the options', () => {
    const result = Question.safeParse({
      id: 'q3',
      text: 'Bad question',
      options: [
        { side: 'A', text: 'Option A' },
        { side: 'B', text: 'Option B' },
      ],
      correctSide: 'C',
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate option sides', () => {
    const result = Question.safeParse({
      id: 'q4',
      text: 'Duplicate sides',
      options: [
        { side: 'A', text: 'First' },
        { side: 'A', text: 'Second' },
      ],
      correctSide: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fewer than 2 options', () => {
    const result = Question.safeParse({
      id: 'q5',
      text: 'Too few',
      options: [{ side: 'A', text: 'Only one' }],
      correctSide: 'A',
    });
    expect(result.success).toBe(false);
  });
});

// ─── session.ts — lifecycle ───────────────────────────────────────────────────

describe('startSession', () => {
  it('transitions pending → active and sets currentQuestionIndex to 0', () => {
    const session = startSession(makeSession());
    expect(session.status).toBe('active');
    expect(session.currentQuestionIndex).toBe(0);
  });

  it('throws when session is already active', () => {
    const active = startSession(makeSession());
    expect(() => startSession(active)).toThrow();
  });

  it('throws when session is closed', () => {
    const active = startSession(makeSession());
    const closed = closeSession(active);
    expect(() => startSession(closed)).toThrow();
  });
});

describe('advanceQuestion', () => {
  it('increments currentQuestionIndex', () => {
    const active = startSession(makeSession());
    const advanced = advanceQuestion(active);
    expect(advanced.currentQuestionIndex).toBe(1);
  });

  it('throws when there are no more questions', () => {
    const session = makeSession();
    const active = startSession(session);
    const atLast = advanceQuestion(active); // index 1 (last of 2)
    expect(() => advanceQuestion(atLast)).toThrow();
  });

  it('throws when session is not active', () => {
    expect(() => advanceQuestion(makeSession())).toThrow();
  });
});

describe('closeSession', () => {
  it('transitions active → closed and clears currentQuestionIndex', () => {
    const active = startSession(makeSession());
    const closed = closeSession(active);
    expect(closed.status).toBe('closed');
    expect(closed.currentQuestionIndex).toBeNull();
  });

  it('throws when session is pending', () => {
    expect(() => closeSession(makeSession())).toThrow();
  });
});

describe('currentQuestion', () => {
  it('returns the question at currentQuestionIndex', () => {
    const active = startSession(makeSession());
    const q = currentQuestion(active);
    expect(q?.id).toBe('q1');
  });

  it('returns undefined when session is pending', () => {
    expect(currentQuestion(makeSession())).toBeUndefined();
  });
});

// ─── tally.ts — tallyQuestion ─────────────────────────────────────────────────

describe('tallyQuestion', () => {
  const question = makeQuestion('q1', 'A');

  it('counts correct and incorrect responses', () => {
    const scans: ScanResult[] = [
      makeScan(1, 'A'),
      makeScan(2, 'A'),
      makeScan(3, 'B'),
      makeScan(4, 'C'),
    ];
    const tally = tallyQuestion(question, scans, 5);
    expect(tally.correct).toBe(2);
    expect(tally.responded).toBe(4);
  });

  it('computes participation and correct rates correctly', () => {
    const scans: ScanResult[] = [makeScan(1, 'A'), makeScan(2, 'B')];
    const tally = tallyQuestion(question, scans, 4);
    expect(tally.participationRate).toBeCloseTo(0.5);
    expect(tally.correctRate).toBeCloseTo(0.5);
  });

  it('deduplicates re-scanned cards, keeping the last scan', () => {
    const scans: ScanResult[] = [
      makeScan(1, 'B'), // first scan: wrong
      makeScan(1, 'A'), // re-scan: correct
    ];
    const tally = tallyQuestion(question, scans, 5);
    expect(tally.correct).toBe(1);
    expect(tally.responded).toBe(1);
  });

  it('handles no responses gracefully', () => {
    const tally = tallyQuestion(question, [], 5);
    expect(tally.responded).toBe(0);
    expect(tally.correctRate).toBe(0);
    expect(tally.participationRate).toBe(0);
  });

  it('marks the correct option in options array', () => {
    const tally = tallyQuestion(question, [], 5);
    const correctOpt = tally.options.find((o) => o.isCorrect);
    expect(correctOpt?.side).toBe('A');
  });
});

// ─── tally.ts — tallySession ──────────────────────────────────────────────────

describe('tallySession', () => {
  const questions = [makeQuestion('q1', 'A'), makeQuestion('q2', 'B')];

  it('produces a tally for every question', () => {
    const result = tallySession(
      'sess-001',
      'Test Session',
      5,
      questions,
      new Map([
        ['q1', [makeScan(1, 'A'), makeScan(2, 'A')]],
        ['q2', [makeScan(1, 'B')]],
      ]),
    );
    expect(result.questionTallies).toHaveLength(2);
  });

  it('treats questions with no scans as zero responded', () => {
    const result = tallySession('sess-001', 'Test', 5, questions, new Map());
    expect(result.questionTallies[0]?.responded).toBe(0);
    expect(result.questionTallies[1]?.responded).toBe(0);
  });

  it('computes overallCorrectRate as the mean of per-question rates', () => {
    const result = tallySession(
      'sess-001',
      'Test Session',
      4,
      questions,
      new Map([
        ['q1', [makeScan(1, 'A'), makeScan(2, 'B')]], // 50% correct
        ['q2', [makeScan(1, 'B'), makeScan(2, 'B')]], // 100% correct
      ]),
    );
    expect(result.overallCorrectRate).toBeCloseTo(0.75);
  });
});

// ─── tally.ts — unscannedCards ────────────────────────────────────────────────

describe('unscannedCards', () => {
  it('returns all cards when no scans have been made', () => {
    const unscanned = unscannedCards(5, []);
    expect(unscanned).toEqual([1, 2, 3, 4, 5]);
  });

  it('excludes scanned card numbers', () => {
    const scans = [makeScan(1, 'A'), makeScan(3, 'B')];
    const unscanned = unscannedCards(5, scans);
    expect(unscanned).toEqual([2, 4, 5]);
  });

  it('returns empty array when all cards are scanned', () => {
    const scans = [1, 2, 3].map((n) => makeScan(n, 'A'));
    const unscanned = unscannedCards(3, scans);
    expect(unscanned).toEqual([]);
  });
});
