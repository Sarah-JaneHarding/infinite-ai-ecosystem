// LE agent contract tests — Stage 13.
//
// Validates the declared shape of all nine LE agent contracts. Static checks only.
// Key invariants:
//   - All LE agents belong to module 'LE' with purpose 'learning_engine'
//   - pii_guard is declared on every agent
//   - LE-05, LE-06, LE-07, LE-08 require human approval (candidates/gate/publication)
//   - LE-01, LE-02, LE-03, LE-04, LE-09 do not require pre-approval (data collection/inference)
//   - Only LE-01, LE-02, LE-03, LE-04, LE-09 write to the Brain
//   - LE-05, LE-06 do not write to the Brain (candidates only)

import { describe, expect, it } from 'vitest';

import { LE01Contract } from '../../src/le/LE-01.contract.js';
import { LE02Contract } from '../../src/le/LE-02.contract.js';
import { LE03Contract } from '../../src/le/LE-03.contract.js';
import { LE04Contract } from '../../src/le/LE-04.contract.js';
import { LE05Contract } from '../../src/le/LE-05.contract.js';
import { LE06Contract } from '../../src/le/LE-06.contract.js';
import { LE07Contract } from '../../src/le/LE-07.contract.js';
import { LE08Contract } from '../../src/le/LE-08.contract.js';
import { LE09Contract } from '../../src/le/LE-09.contract.js';

const ALL_LE = [
  LE01Contract,
  LE02Contract,
  LE03Contract,
  LE04Contract,
  LE05Contract,
  LE06Contract,
  LE07Contract,
  LE08Contract,
  LE09Contract,
];

const CANDIDATE_AGENTS = [LE05Contract, LE06Contract, LE07Contract, LE08Contract];
const COLLECTION_AGENTS = [
  LE01Contract,
  LE02Contract,
  LE03Contract,
  LE04Contract,
  LE09Contract,
];

describe('All LE agents', () => {
  it('are registered to the LE module', () => {
    for (const c of ALL_LE) {
      expect(c.module).toBe('LE');
    }
  });

  it('declare purpose learning_engine', () => {
    for (const c of ALL_LE) {
      expect(c.purpose).toBe('learning_engine');
    }
  });

  it('declare pii_guard on every agent', () => {
    for (const c of ALL_LE) {
      expect(c.guardrails).toContain('pii_guard');
    }
  });

  it('declare a cost budget', () => {
    for (const c of ALL_LE) {
      expect(c.budget.maxCostUsd).toBeGreaterThan(0);
      expect(c.budget.maxTokens).toBeGreaterThan(0);
    }
  });

  it('each agent has a distinct id', () => {
    const ids = ALL_LE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ALL_LE.length);
  });

  it('each agent has a semver version', () => {
    for (const c of ALL_LE) {
      expect(c.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe('LE candidate/gate agents (LE-05, LE-06, LE-07, LE-08)', () => {
  it('require human approval before output becomes live', () => {
    for (const c of CANDIDATE_AGENTS) {
      expect(c.requiresApproval).toBe(true);
    }
  });
});

describe('LE collection agents (LE-01, LE-02, LE-03, LE-04, LE-09)', () => {
  it('do not require pre-approval — they collect and infer, not promote', () => {
    for (const c of COLLECTION_AGENTS) {
      expect(c.requiresApproval).toBe(false);
    }
  });

  it('write to the Brain (data collection and attribution are Brain writes)', () => {
    for (const c of COLLECTION_AGENTS) {
      expect(c.writesToBrain).toBe(true);
    }
  });
});

describe('LE-05 Exemplar Curator', () => {
  it('does not write to the Brain — candidates only', () => {
    expect(LE05Contract.writesToBrain).toBe(false);
  });

  it('declares a budget appropriate for exemplar scoring', () => {
    expect(LE05Contract.budget.maxTokens).toBeLessThanOrEqual(3000);
  });
});

describe('LE-06 Prompt Evolver', () => {
  it('does not write to the Brain — challenger is never live without LE-07 + ratification', () => {
    expect(LE06Contract.writesToBrain).toBe(false);
  });

  it('declares a higher token budget to allow detailed prompt drafting', () => {
    expect(LE06Contract.budget.maxTokens).toBeGreaterThan(2000);
  });
});

describe('LE-07 Eval Gatekeeper', () => {
  it('does not write to the Brain — verdict only, promotion is downstream', () => {
    expect(LE07Contract.writesToBrain).toBe(false);
  });
});

describe('LE-08 Commons Publisher', () => {
  it('writes to the Brain — the published-pattern registry is a Brain write', () => {
    expect(LE08Contract.writesToBrain).toBe(true);
  });
});

describe('Agent IDs', () => {
  it('LE-01 through LE-09 are all present', () => {
    const expectedIds = [
      'LE-01',
      'LE-02',
      'LE-03',
      'LE-04',
      'LE-05',
      'LE-06',
      'LE-07',
      'LE-08',
      'LE-09',
    ];
    const actualIds = ALL_LE.map((c) => c.id).sort();
    expect(actualIds).toEqual(expectedIds);
  });
});
