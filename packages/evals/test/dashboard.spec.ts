import { describe, expect, it } from 'vitest';

import { buildAgentDashboard, type RunHistoryEntry } from '../src/dashboard.js';
import type { EvalRunResult } from '../src/runner.js';

function result(
  agentId: string,
  agentVersion: string,
  passRate: number,
  totalCostUsd = 0,
): EvalRunResult {
  return {
    agentId,
    agentVersion,
    cases: [],
    metrics: {
      totalCases: 1,
      passedCases: passRate === 1 ? 1 : 0,
      failedCases: passRate === 1 ? 0 : 1,
      passRate,
      totalTokens: 100,
      totalCostUsd,
      totalLatencyMs: 10,
    },
  };
}

describe('buildAgentDashboard', () => {
  it('builds scoreOverTime and costOverTime sorted oldest first', () => {
    const history: RunHistoryEntry[] = [
      { at: new Date('2026-08-02'), result: result('CE-05', '1.1.0', 0.9, 0.02) },
      { at: new Date('2026-08-01'), result: result('CE-05', '1.0.0', 0.7, 0.01) },
    ];
    const dashboard = buildAgentDashboard('CE-05', history);

    expect(dashboard.scoreOverTime.map((p) => p.agentVersion)).toEqual([
      '1.0.0',
      '1.1.0',
    ]);
    expect(dashboard.scoreOverTime.map((p) => p.passRate)).toEqual([0.7, 0.9]);
    expect(dashboard.costOverTime.map((p) => p.totalCostUsd)).toEqual([0.01, 0.02]);
  });

  it('champion history only includes runs that were actually submitted for promotion', () => {
    const history: RunHistoryEntry[] = [
      { at: new Date('2026-08-01'), result: result('CE-05', '1.0.0', 0.7) },
      {
        at: new Date('2026-08-02'),
        result: result('CE-05', '1.1.0', 0.9),
        promotionVerdict: { promote: true },
      },
    ];
    const dashboard = buildAgentDashboard('CE-05', history);
    expect(dashboard.championHistory).toHaveLength(1);
    expect(dashboard.championHistory[0]?.promoted).toBe(true);
    expect(dashboard.championHistory[0]?.refusals).toEqual([]);
  });

  it('carries promotion refusals into a rejected champion-history entry', () => {
    const history: RunHistoryEntry[] = [
      {
        at: new Date('2026-08-02'),
        result: result('CE-05', '1.1.0', 0.9),
        promotionVerdict: {
          promote: false,
          refusals: [{ code: 'over_budget', detail: 'Too expensive.' }],
        },
      },
    ];
    const dashboard = buildAgentDashboard('CE-05', history);
    expect(dashboard.championHistory[0]?.promoted).toBe(false);
    expect(dashboard.championHistory[0]?.refusals).toEqual([
      { code: 'over_budget', detail: 'Too expensive.' },
    ]);
  });

  it('throws when a history entry belongs to a different agent', () => {
    const history: RunHistoryEntry[] = [
      { at: new Date(), result: result('CE-06', '1.0.0', 1) },
    ];
    expect(() => buildAgentDashboard('CE-05', history)).toThrow(RangeError);
  });

  it('returns empty series for an agent with no history', () => {
    const dashboard = buildAgentDashboard('CE-05', []);
    expect(dashboard.scoreOverTime).toEqual([]);
    expect(dashboard.costOverTime).toEqual([]);
    expect(dashboard.championHistory).toEqual([]);
  });
});
