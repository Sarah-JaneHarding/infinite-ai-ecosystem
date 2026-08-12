// Answer-key verification with seeded wrong keys — Stage 11 step 8.
//
// "Answer keys are verified by a separate correctness pass (a second agent solving the
// items independently and comparing) before the teacher sees them. Disagreement blocks
// release and flags the item." — TB-05 design, build manual Stage 11.
//
// These tests seed wrong answers into AnswerKeyItem fixtures and assert that
// AnswerKeyVerificationResult.verdict === 'disagreement' blocks release. A seeded wrong
// key is an AnswerKeyItem where agrees === false (the author and verifier produced
// different answers for the same question).

import { describe, expect, it } from 'vitest';

import { AnswerKeyItem, AnswerKeyVerificationResult } from '../src/toolbox/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function correctItem(id: string): unknown {
  return {
    itemId: id,
    question: 'What is 7 × 8?',
    authorAnswer: '56',
    verifierAnswer: '56',
    agrees: true,
  };
}

function seededWrongItem(id: string): unknown {
  return {
    itemId: id,
    question: 'What is 7 × 8?',
    authorAnswer: '54', // wrong
    verifierAnswer: '56', // correct — verifier disagrees
    agrees: false,
  };
}

// ---------------------------------------------------------------------------
// AnswerKeyItem
// ---------------------------------------------------------------------------

describe('AnswerKeyItem', () => {
  it('accepts a correct item where both agents agree', () => {
    expect(AnswerKeyItem.safeParse(correctItem('item-1')).success).toBe(true);
  });

  it('accepts a seeded wrong item where agrees is false', () => {
    expect(AnswerKeyItem.safeParse(seededWrongItem('item-1')).success).toBe(true);
  });

  it('rejects an item with an empty question', () => {
    expect(
      AnswerKeyItem.safeParse({
        itemId: 'item-1',
        question: '',
        authorAnswer: '56',
        verifierAnswer: '56',
        agrees: true,
      }).success,
    ).toBe(false);
  });

  it('rejects an item with an empty authorAnswer', () => {
    expect(
      AnswerKeyItem.safeParse({
        itemId: 'item-1',
        question: 'What is 7 × 8?',
        authorAnswer: '',
        verifierAnswer: '56',
        agrees: true,
      }).success,
    ).toBe(false);
  });

  it('rejects an item with an empty itemId', () => {
    expect(
      AnswerKeyItem.safeParse({
        itemId: '',
        question: 'What is 7 × 8?',
        authorAnswer: '56',
        verifierAnswer: '56',
        agrees: true,
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AnswerKeyVerificationResult — verified (all items agree)
// ---------------------------------------------------------------------------

describe('AnswerKeyVerificationResult — verified verdict', () => {
  it('accepts a verified result when all items agree', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'verified',
        items: [correctItem('item-1'), correctItem('item-2')],
      }).success,
    ).toBe(true);
  });

  it('rejects a verified result with an empty items array — at least one item required', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'verified',
        items: [],
      }).success,
    ).toBe(false);
  });

  it('accepts a verified result with a single item', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'verified',
        items: [correctItem('item-1')],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AnswerKeyVerificationResult — disagreement (seeded wrong keys)
// ---------------------------------------------------------------------------

describe('AnswerKeyVerificationResult — disagreement verdict (seeded wrong keys)', () => {
  it('accepts a disagreement result with one seeded wrong key', () => {
    const result = {
      verdict: 'disagreement',
      flaggedItems: [seededWrongItem('item-2')],
      allItems: [correctItem('item-1'), seededWrongItem('item-2')],
    };
    expect(AnswerKeyVerificationResult.safeParse(result).success).toBe(true);
  });

  it('accepts a disagreement result where all items are wrong', () => {
    const result = {
      verdict: 'disagreement',
      flaggedItems: [seededWrongItem('item-1'), seededWrongItem('item-2')],
      allItems: [seededWrongItem('item-1'), seededWrongItem('item-2')],
    };
    expect(AnswerKeyVerificationResult.safeParse(result).success).toBe(true);
  });

  it('rejects a disagreement result with an empty flaggedItems array', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'disagreement',
        flaggedItems: [],
        allItems: [correctItem('item-1')],
      }).success,
    ).toBe(false);
  });

  it('rejects a disagreement result with an empty allItems array', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'disagreement',
        flaggedItems: [seededWrongItem('item-1')],
        allItems: [],
      }).success,
    ).toBe(false);
  });

  it('disagreement result records the flagged items with agrees === false', () => {
    const parsed = AnswerKeyVerificationResult.parse({
      verdict: 'disagreement',
      flaggedItems: [seededWrongItem('item-3')],
      allItems: [correctItem('item-1'), correctItem('item-2'), seededWrongItem('item-3')],
    });
    if (parsed.verdict === 'disagreement') {
      expect(parsed.flaggedItems).toHaveLength(1);
      expect(parsed.flaggedItems[0]?.agrees).toBe(false);
    }
  });

  it('a disagreement result has no artefactId — release is blocked', () => {
    const parsed = AnswerKeyVerificationResult.parse({
      verdict: 'disagreement',
      flaggedItems: [seededWrongItem('item-1')],
      allItems: [seededWrongItem('item-1')],
    });
    expect(parsed).not.toHaveProperty('artefactId');
  });
});

describe('AnswerKeyVerificationResult — schema rejects unknown verdicts', () => {
  it('rejects an unknown verdict', () => {
    expect(
      AnswerKeyVerificationResult.safeParse({
        verdict: 'partial',
        items: [correctItem('item-1')],
      }).success,
    ).toBe(false);
  });
});
