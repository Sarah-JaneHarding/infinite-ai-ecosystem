import { describe, expect, it } from 'vitest';

import { BrainExtractionError, extractTyped } from '../src/write-path-schemas.js';

describe('extractTyped', () => {
  it('extracts an L0_CONSTITUTION payload, defaulting content to whatever was given', () => {
    const extracted = extractTyped('L0_CONSTITUTION', {
      key: 'assessment_policy',
      kind: 'ASSESSMENT_POLICY',
      content: { weighting: 'term-based' },
    });
    expect(extracted).toEqual({
      targetTier: 'L0_CONSTITUTION',
      payload: {
        key: 'assessment_policy',
        kind: 'ASSESSMENT_POLICY',
        content: { weighting: 'term-based' },
      },
    });
  });

  it('extracts an L3_PROCEDURE payload', () => {
    const extracted = extractTyped('L3_PROCEDURE', {
      kind: 'SOP',
      ref: 'sbst-referral',
      content: { steps: ['screen', 'refer'] },
    });
    expect(extracted).toEqual({
      targetTier: 'L3_PROCEDURE',
      payload: {
        kind: 'SOP',
        ref: 'sbst-referral',
        content: { steps: ['screen', 'refer'] },
      },
    });
  });

  it('defaults an L1_NODE payload with no externalRef, attributes or supersedes', () => {
    const extracted = extractTyped('L1_NODE', {
      entityType: 'TOPIC',
      label: 'Fractions',
    });
    expect(extracted).toEqual({
      targetTier: 'L1_NODE',
      payload: {
        entityType: 'TOPIC',
        externalRef: null,
        label: 'Fractions',
        attributes: {},
        supersedes: null,
      },
    });
  });

  it('carries a declared externalRef and supersedes through unchanged', () => {
    const extracted = extractTyped('L1_NODE', {
      entityType: 'LEARNER',
      externalRef: 'LNR_ABC123',
      label: 'A learner',
      supersedes: '11111111-1111-4111-8111-111111111111',
    });
    expect(extracted.targetTier).toBe('L1_NODE');
    expect(extracted.payload).toMatchObject({
      externalRef: 'LNR_ABC123',
      supersedes: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('extracts an L1_EDGE payload', () => {
    const sourceId = '11111111-1111-4111-8111-111111111111';
    const targetId = '22222222-2222-4222-8222-222222222222';
    const extracted = extractTyped('L1_EDGE', {
      sourceId,
      targetId,
      relation: 'prerequisite_of',
    });
    expect(extracted).toEqual({
      targetTier: 'L1_EDGE',
      payload: {
        sourceId,
        targetId,
        relation: 'prerequisite_of',
        attributes: {},
        supersedes: null,
      },
    });
  });

  it('extracts an L2_EPISODE payload, coercing occurredAt', () => {
    const extracted = extractTyped('L2_EPISODE', {
      eventType: 'screening_flag_raised',
      occurredAt: '2026-05-01T00:00:00.000Z',
      summary: 'Reading screener flagged below benchmark.',
    });
    expect(extracted.targetTier).toBe('L2_EPISODE');
    if (extracted.targetTier !== 'L2_EPISODE') throw new Error('unreachable');
    expect(extracted.payload.occurredAt).toBeInstanceOf(Date);
    expect(extracted.payload.occurredAt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('throws BrainExtractionError on a missing required field', () => {
    expect(() => extractTyped('L0_CONSTITUTION', { kind: 'SCHOOL_POLICY' })).toThrow(
      BrainExtractionError,
    );
  });

  it('throws BrainExtractionError on a payload that is not an object', () => {
    expect(() => extractTyped('L1_NODE', 'not an object')).toThrow(BrainExtractionError);
  });

  it('throws BrainExtractionError on a bad enum value', () => {
    expect(() =>
      extractTyped('L1_NODE', { entityType: 'NOT_A_REAL_TYPE', label: 'x' }),
    ).toThrow(BrainExtractionError);
  });

  it('throws BrainExtractionError on a malformed supersedes id', () => {
    expect(() =>
      extractTyped('L1_NODE', {
        entityType: 'TOPIC',
        label: 'x',
        supersedes: 'not-a-uuid',
      }),
    ).toThrow(BrainExtractionError);
  });
});
