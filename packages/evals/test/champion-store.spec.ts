import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadChampionResult, saveChampionResult } from '../src/champion-store.js';
import type { EvalRunResult } from '../src/runner.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'evals-champions-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function result(agentId: string): EvalRunResult {
  return {
    agentId,
    agentVersion: '1.0.0',
    cases: [],
    metrics: {
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      passRate: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
    },
  };
}

describe('champion store', () => {
  it('returns null for an agent with no stored champion, and for a missing root directory', () => {
    expect(loadChampionResult(dir, 'CE-05')).toBeNull();
    expect(loadChampionResult(path.join(dir, 'missing'), 'CE-05')).toBeNull();
  });

  it('round-trips a saved result', () => {
    saveChampionResult(dir, result('CE-05'));
    const loaded = loadChampionResult(dir, 'CE-05');
    expect(loaded?.agentId).toBe('CE-05');
    expect(loaded?.agentVersion).toBe('1.0.0');
  });

  it('creates the champions root if it does not exist yet', () => {
    const freshRoot = path.join(dir, 'nested', 'champions');
    saveChampionResult(freshRoot, result('CE-05'));
    expect(loadChampionResult(freshRoot, 'CE-05')?.agentId).toBe('CE-05');
  });

  it('a later save overwrites the previous champion for the same agent', () => {
    saveChampionResult(dir, { ...result('CE-05'), agentVersion: '1.0.0' });
    saveChampionResult(dir, { ...result('CE-05'), agentVersion: '2.0.0' });
    expect(loadChampionResult(dir, 'CE-05')?.agentVersion).toBe('2.0.0');
  });

  it('stores different agents independently', () => {
    saveChampionResult(dir, result('CE-05'));
    saveChampionResult(dir, result('CE-06'));
    expect(loadChampionResult(dir, 'CE-05')?.agentId).toBe('CE-05');
    expect(loadChampionResult(dir, 'CE-06')?.agentId).toBe('CE-06');
  });
});
