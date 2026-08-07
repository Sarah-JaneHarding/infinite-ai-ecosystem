// SIAS state machine unit tests — Stage 10 step 1.
//
// The state machine has three invariants to prove:
//   1. Every legal transition succeeds when its preconditions are met.
//   2. Every illegal transition is refused with a typed error.
//   3. Ratification-gated transitions are refused without a ratification record, and
//      succeed with one — proving the human gate is a hard requirement, not a soft check.
//
// Terminal states are proven to refuse ALL transitions, including safeguarding escalation,
// since a case that is already REFERRED, EXITED or SAFEGUARDING_ESCALATED cannot be
// further advanced.

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  LEGAL_TRANSITIONS,
  SiasTransitionError,
  isSiasTerminal,
  legalNextStates,
  transitionSias,
  type SbstRatification,
  type SiasStatus,
} from '../src/index.js';

const LEARNER = randomUUID();
const ACTOR = 'AC-01';
const NOW = new Date('2026-08-07T09:00:00.000Z');

function mkRatification(): SbstRatification {
  return {
    ratificationId: randomUUID(),
    ratifiedBy: randomUUID(),
    ratifiedAt: NOW,
  };
}

describe('transitionSias — legal transitions without ratification', () => {
  it('advances PENDING_SCREEN → SCREENED', () => {
    const { nextStatus, audit } = transitionSias(
      LEARNER,
      'PENDING_SCREEN',
      'SCREENED',
      ACTOR,
      NOW,
    );
    expect(nextStatus).toBe('SCREENED');
    expect(audit.fromStatus).toBe('PENDING_SCREEN');
    expect(audit.toStatus).toBe('SCREENED');
    expect(audit.learnerId).toBe(LEARNER);
    expect(audit.triggeredBy).toBe(ACTOR);
    expect(audit.triggeredAt).toEqual(NOW);
    expect(audit.ratificationId).toBeNull();
  });

  it('advances PENDING_SCREEN → CORE_HEALTH_BLOCKED when class core health fails', () => {
    const { nextStatus } = transitionSias(
      LEARNER,
      'PENDING_SCREEN',
      'CORE_HEALTH_BLOCKED',
      ACTOR,
      NOW,
    );
    expect(nextStatus).toBe('CORE_HEALTH_BLOCKED');
  });

  it('advances CORE_HEALTH_BLOCKED → SCREENED once class core health is resolved', () => {
    const { nextStatus } = transitionSias(
      LEARNER,
      'CORE_HEALTH_BLOCKED',
      'SCREENED',
      ACTOR,
      NOW,
    );
    expect(nextStatus).toBe('SCREENED');
  });

  it('advances SCREENED → SBST_REVIEW (tier recommendation submitted)', () => {
    const { nextStatus } = transitionSias(LEARNER, 'SCREENED', 'SBST_REVIEW', ACTOR, NOW);
    expect(nextStatus).toBe('SBST_REVIEW');
  });

  it('advances INTERVENTION_ACTIVE → MONITORING once intervention is delivered', () => {
    const { nextStatus } = transitionSias(
      LEARNER,
      'INTERVENTION_ACTIVE',
      'MONITORING',
      ACTOR,
      NOW,
    );
    expect(nextStatus).toBe('MONITORING');
  });

  it('advances MONITORING → SBST_REVIEW for periodic review', () => {
    const { nextStatus } = transitionSias(
      LEARNER,
      'MONITORING',
      'SBST_REVIEW',
      ACTOR,
      NOW,
    );
    expect(nextStatus).toBe('SBST_REVIEW');
  });
});

describe('transitionSias — ratification-gated transitions succeed with ratification', () => {
  it('SBST_REVIEW → INTERVENTION_ACTIVE with ratification', () => {
    const ratification = mkRatification();
    const { nextStatus, audit } = transitionSias(
      LEARNER,
      'SBST_REVIEW',
      'INTERVENTION_ACTIVE',
      ACTOR,
      NOW,
      ratification,
    );
    expect(nextStatus).toBe('INTERVENTION_ACTIVE');
    expect(audit.ratificationId).toBe(ratification.ratificationId);
  });

  it('SBST_REVIEW → EXITED with ratification', () => {
    const ratification = mkRatification();
    const { nextStatus } = transitionSias(
      LEARNER,
      'SBST_REVIEW',
      'EXITED',
      ACTOR,
      NOW,
      ratification,
    );
    expect(nextStatus).toBe('EXITED');
  });

  it('SBST_REVIEW → REFERRAL_PENDING with ratification', () => {
    const ratification = mkRatification();
    const { nextStatus } = transitionSias(
      LEARNER,
      'SBST_REVIEW',
      'REFERRAL_PENDING',
      ACTOR,
      NOW,
      ratification,
    );
    expect(nextStatus).toBe('REFERRAL_PENDING');
  });

  it('REFERRAL_PENDING → REFERRED with ratification (referral sign-off)', () => {
    const ratification = mkRatification();
    const { nextStatus } = transitionSias(
      LEARNER,
      'REFERRAL_PENDING',
      'REFERRED',
      ACTOR,
      NOW,
      ratification,
    );
    expect(nextStatus).toBe('REFERRED');
  });
});

describe('transitionSias — ratification-gated transitions refused without ratification', () => {
  it('refuses SBST_REVIEW → INTERVENTION_ACTIVE without ratification', () => {
    expect(() =>
      transitionSias(LEARNER, 'SBST_REVIEW', 'INTERVENTION_ACTIVE', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses SBST_REVIEW → EXITED without ratification', () => {
    expect(() => transitionSias(LEARNER, 'SBST_REVIEW', 'EXITED', ACTOR, NOW)).toThrow(
      SiasTransitionError,
    );
  });

  it('refuses SBST_REVIEW → REFERRAL_PENDING without ratification', () => {
    expect(() =>
      transitionSias(LEARNER, 'SBST_REVIEW', 'REFERRAL_PENDING', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses REFERRAL_PENDING → REFERRED without ratification', () => {
    expect(() =>
      transitionSias(LEARNER, 'REFERRAL_PENDING', 'REFERRED', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });
});

describe('transitionSias — illegal transitions are refused', () => {
  it('refuses a backwards transition (MONITORING → PENDING_SCREEN)', () => {
    expect(() =>
      transitionSias(LEARNER, 'MONITORING', 'PENDING_SCREEN', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses skipping SBST_REVIEW (SCREENED → INTERVENTION_ACTIVE)', () => {
    expect(() =>
      transitionSias(LEARNER, 'SCREENED', 'INTERVENTION_ACTIVE', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses skipping SBST_REVIEW (SCREENED → REFERRAL_PENDING)', () => {
    expect(() =>
      transitionSias(LEARNER, 'SCREENED', 'REFERRAL_PENDING', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses CORE_HEALTH_BLOCKED → SBST_REVIEW (must pass through SCREENED first)', () => {
    expect(() =>
      transitionSias(LEARNER, 'CORE_HEALTH_BLOCKED', 'SBST_REVIEW', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('refuses INTERVENTION_ACTIVE → REFERRED (must go through MONITORING → SBST_REVIEW → REFERRAL_PENDING)', () => {
    expect(() =>
      transitionSias(LEARNER, 'INTERVENTION_ACTIVE', 'REFERRED', ACTOR, NOW),
    ).toThrow(SiasTransitionError);
  });

  it('SiasTransitionError records from and to states', () => {
    let caught: unknown;
    try {
      transitionSias(LEARNER, 'MONITORING', 'PENDING_SCREEN', ACTOR, NOW);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SiasTransitionError);
    const error = caught as SiasTransitionError;
    expect(error.from).toBe('MONITORING');
    expect(error.to).toBe('PENDING_SCREEN');
    expect(error.name).toBe('SiasTransitionError');
  });
});

describe('transitionSias — terminal states refuse all transitions', () => {
  const terminals: SiasStatus[] = ['REFERRED', 'EXITED', 'SAFEGUARDING_ESCALATED'];

  for (const terminal of terminals) {
    it(`${terminal} refuses any further transition, including SAFEGUARDING_ESCALATED`, () => {
      expect(() =>
        transitionSias(LEARNER, terminal, 'SAFEGUARDING_ESCALATED', ACTOR, NOW),
      ).toThrow(SiasTransitionError);
    });
  }
});

describe('transitionSias — safeguarding escalation bypasses all queues', () => {
  const nonTerminalStates: SiasStatus[] = [
    'PENDING_SCREEN',
    'SCREENED',
    'CORE_HEALTH_BLOCKED',
    'SBST_REVIEW',
    'INTERVENTION_ACTIVE',
    'MONITORING',
    'REFERRAL_PENDING',
  ];

  for (const state of nonTerminalStates) {
    it(`escalates to SAFEGUARDING_ESCALATED from ${state} without ratification`, () => {
      const { nextStatus } = transitionSias(
        LEARNER,
        state,
        'SAFEGUARDING_ESCALATED',
        ACTOR,
        NOW,
      );
      expect(nextStatus).toBe('SAFEGUARDING_ESCALATED');
    });
  }
});

describe('isSiasTerminal', () => {
  it('returns true for terminal states', () => {
    expect(isSiasTerminal('REFERRED')).toBe(true);
    expect(isSiasTerminal('EXITED')).toBe(true);
    expect(isSiasTerminal('SAFEGUARDING_ESCALATED')).toBe(true);
  });

  it('returns false for non-terminal states', () => {
    expect(isSiasTerminal('PENDING_SCREEN')).toBe(false);
    expect(isSiasTerminal('SCREENED')).toBe(false);
    expect(isSiasTerminal('SBST_REVIEW')).toBe(false);
    expect(isSiasTerminal('INTERVENTION_ACTIVE')).toBe(false);
    expect(isSiasTerminal('MONITORING')).toBe(false);
    expect(isSiasTerminal('REFERRAL_PENDING')).toBe(false);
    expect(isSiasTerminal('CORE_HEALTH_BLOCKED')).toBe(false);
  });
});

describe('legalNextStates', () => {
  it('returns empty array for terminal states', () => {
    expect(legalNextStates('REFERRED')).toEqual([]);
    expect(legalNextStates('EXITED')).toEqual([]);
    expect(legalNextStates('SAFEGUARDING_ESCALATED')).toEqual([]);
  });

  it('returns the correct targets for PENDING_SCREEN', () => {
    const targets = legalNextStates('PENDING_SCREEN');
    expect(targets).toContain('SCREENED');
    expect(targets).toContain('CORE_HEALTH_BLOCKED');
    expect(targets).toContain('SAFEGUARDING_ESCALATED');
  });

  it('returns the correct targets for MONITORING (includes SBST_REVIEW for periodic review)', () => {
    const targets = legalNextStates('MONITORING');
    expect(targets).toContain('SBST_REVIEW');
    expect(targets).toContain('SAFEGUARDING_ESCALATED');
  });

  it('returns empty array for a state with no registered transitions (defence-in-depth)', () => {
    // Cast an unknown string through the type so the Map lookup returns undefined,
    // exercising the fallback branch in legalNextStates.
    const result = legalNextStates('__UNKNOWN__' as SiasStatus);
    expect(result).toEqual([]);
  });
});

describe('LEGAL_TRANSITIONS table integrity', () => {
  it('has no duplicate entries', () => {
    const keys = LEGAL_TRANSITIONS.map((t) => `${t.from}→${t.to}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('lists every non-terminal state as at least one transition source', () => {
    const sources = new Set(LEGAL_TRANSITIONS.map((t) => t.from));
    const nonTerminals: SiasStatus[] = [
      'PENDING_SCREEN',
      'SCREENED',
      'CORE_HEALTH_BLOCKED',
      'SBST_REVIEW',
      'INTERVENTION_ACTIVE',
      'MONITORING',
      'REFERRAL_PENDING',
    ];
    for (const state of nonTerminals) {
      expect(sources.has(state), `${state} should appear as a transition source`).toBe(
        true,
      );
    }
  });
});
