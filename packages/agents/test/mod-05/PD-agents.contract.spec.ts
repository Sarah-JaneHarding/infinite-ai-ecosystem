// PD agent contract tests — Stage 12 step 2.
//
// Validates the declared shape of all eight PD agent contracts. These are
// static checks — no model calls. Key invariants:
//   - All PD agents belong to MOD-05 with purpose 'pd_analytics'
//   - pii_guard is declared on every agent
//   - source_grounding_guard is declared on agents that consume source documents
//   - No agent writes to the Brain or requires pre-approval
//   - Budget ceilings are reasonable for PD analytics workloads

import { describe, expect, it } from 'vitest';

import { PD01Contract } from '../../src/mod-05/PD-01.contract.js';
import { PD02Contract } from '../../src/mod-05/PD-02.contract.js';
import { PD03Contract } from '../../src/mod-05/PD-03.contract.js';
import { PD04Contract } from '../../src/mod-05/PD-04.contract.js';
import { PD05Contract } from '../../src/mod-05/PD-05.contract.js';
import { PD06Contract } from '../../src/mod-05/PD-06.contract.js';
import { PD07Contract } from '../../src/mod-05/PD-07.contract.js';
import { PD08Contract } from '../../src/mod-05/PD-08.contract.js';

const ALL_PD = [
  PD01Contract,
  PD02Contract,
  PD03Contract,
  PD04Contract,
  PD05Contract,
  PD06Contract,
  PD07Contract,
  PD08Contract,
];

// ---------------------------------------------------------------------------
// Cross-cutting invariants — apply to every PD agent
// ---------------------------------------------------------------------------

describe('All PD agents', () => {
  it('are registered to MOD-05', () => {
    for (const c of ALL_PD) {
      expect(c.module).toBe('MOD-05');
    }
  });

  it('declare purpose pd_analytics', () => {
    for (const c of ALL_PD) {
      expect(c.purpose).toBe('pd_analytics');
    }
  });

  it('declare pii_guard on every agent', () => {
    for (const c of ALL_PD) {
      expect(c.guardrails).toContain('pii_guard');
    }
  });

  it('do not require pre-approval — PD outputs are advisory, not execution', () => {
    for (const c of ALL_PD) {
      expect(c.requiresApproval).toBe(false);
    }
  });

  it('do not write to the Brain — PD outputs are tenant reports, not versioned facts', () => {
    for (const c of ALL_PD) {
      expect(c.writesToBrain).toBe(false);
    }
  });

  it('reference a 1.0.0 prompt', () => {
    for (const c of ALL_PD) {
      expect(c.promptRef.version).toBe('1.0.0');
    }
  });

  it('declare no tools — all PD agents are pure language agents', () => {
    for (const c of ALL_PD) {
      expect(c.tools).toEqual([]);
    }
  });

  it('have a positive token budget', () => {
    for (const c of ALL_PD) {
      expect(c.budget.maxTokens).toBeGreaterThan(0);
    }
  });

  it('have a cost budget within the MOD-05 per-call ceiling (0.02 USD)', () => {
    for (const c of ALL_PD) {
      expect(c.budget.maxCostUsd).toBeLessThanOrEqual(0.02);
    }
  });
});

// ---------------------------------------------------------------------------
// PD-01 — Coverage vs Pacing Analyst
// ---------------------------------------------------------------------------

describe('PD-01 contract', () => {
  it('declares id PD-01', () => {
    expect(PD01Contract.id).toBe('PD-01');
  });

  it('uses the pd.coverage logical model', () => {
    expect(PD01Contract.model).toBe('pd.coverage');
  });

  it('references the PD-01 eval set', () => {
    expect(PD01Contract.evalSetRef).toBe('PD-01');
  });
});

// ---------------------------------------------------------------------------
// PD-02 — Assessment Quality Analyst
// ---------------------------------------------------------------------------

describe('PD-02 contract', () => {
  it('declares id PD-02', () => {
    expect(PD02Contract.id).toBe('PD-02');
  });

  it('uses the pd.assess logical model', () => {
    expect(PD02Contract.model).toBe('pd.assess');
  });

  it('references the PD-02 eval set', () => {
    expect(PD02Contract.evalSetRef).toBe('PD-02');
  });
});

// ---------------------------------------------------------------------------
// PD-03 — Observation Analyst
// ---------------------------------------------------------------------------

describe('PD-03 contract', () => {
  it('declares id PD-03', () => {
    expect(PD03Contract.id).toBe('PD-03');
  });

  it('uses the pd.observe logical model', () => {
    expect(PD03Contract.model).toBe('pd.observe');
  });

  it('declares source_grounding_guard — themes must be drawn from walkthrough notes', () => {
    expect(PD03Contract.guardrails).toContain('source_grounding_guard');
  });

  it('references the PD-03 eval set', () => {
    expect(PD03Contract.evalSetRef).toBe('PD-03');
  });
});

// ---------------------------------------------------------------------------
// PD-04 — Practice Signal Aggregator
// ---------------------------------------------------------------------------

describe('PD-04 contract', () => {
  it('declares id PD-04', () => {
    expect(PD04Contract.id).toBe('PD-04');
  });

  it('uses the pd.aggregate logical model', () => {
    expect(PD04Contract.model).toBe('pd.aggregate');
  });

  it('references the PD-04 eval set', () => {
    expect(PD04Contract.evalSetRef).toBe('PD-04');
  });
});

// ---------------------------------------------------------------------------
// PD-05 — PD Gap Detector
// ---------------------------------------------------------------------------

describe('PD-05 contract', () => {
  it('declares id PD-05', () => {
    expect(PD05Contract.id).toBe('PD-05');
  });

  it('uses the pd.detect logical model', () => {
    expect(PD05Contract.model).toBe('pd.detect');
  });

  it('references the PD-05 eval set', () => {
    expect(PD05Contract.evalSetRef).toBe('PD-05');
  });
});

// ---------------------------------------------------------------------------
// PD-06 — Micro-Course Composer
// ---------------------------------------------------------------------------

describe('PD-06 contract', () => {
  it('declares id PD-06', () => {
    expect(PD06Contract.id).toBe('PD-06');
  });

  it('uses the pd.compose logical model', () => {
    expect(PD06Contract.model).toBe('pd.compose');
  });

  it('declares source_grounding_guard — course content must be grounded in L3 exemplars', () => {
    expect(PD06Contract.guardrails).toContain('source_grounding_guard');
  });

  it('references the PD-06 eval set', () => {
    expect(PD06Contract.evalSetRef).toBe('PD-06');
  });
});

// ---------------------------------------------------------------------------
// PD-07 — Coaching Plan Agent
// ---------------------------------------------------------------------------

describe('PD-07 contract', () => {
  it('declares id PD-07', () => {
    expect(PD07Contract.id).toBe('PD-07');
  });

  it('uses the pd.coach logical model', () => {
    expect(PD07Contract.model).toBe('pd.coach');
  });

  it('declares source_grounding_guard — coaching plans must cite evidence from source docs', () => {
    expect(PD07Contract.guardrails).toContain('source_grounding_guard');
  });

  it('references the PD-07 eval set', () => {
    expect(PD07Contract.evalSetRef).toBe('PD-07');
  });
});

// ---------------------------------------------------------------------------
// PD-08 — CPTD Tracker
// ---------------------------------------------------------------------------

describe('PD-08 contract', () => {
  it('declares id PD-08', () => {
    expect(PD08Contract.id).toBe('PD-08');
  });

  it('uses the pd.cptd logical model', () => {
    expect(PD08Contract.model).toBe('pd.cptd');
  });

  it('declares source_grounding_guard — CPTD points must be read from L0 policy docs', () => {
    expect(PD08Contract.guardrails).toContain('source_grounding_guard');
  });

  it('references the PD-08 eval set', () => {
    expect(PD08Contract.evalSetRef).toBe('PD-08');
  });
});
