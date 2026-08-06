// The eval dashboard — Stage 07 step 8.
//
// "Publish an eval dashboard: per agent, score over time, cost over time, champion
// history." This builds the three named series from a run history a caller already has —
// it does not publish anything itself. No page renders this yet: `apps/web` has no eval
// surface built (that is Stage 14's "experience surfaces" job, or a module's own admin
// screen, neither of which exists at this point in the build), the same "backend data
// shape now, the UI surface once one exists" split Stage 06 step 9 already drew between
// `inspectRun` and the Run Inspector's own eventual screen. Nothing here decides how a
// history is stored either — a caller supplies it, exactly the shape
// `packages/evals/champions` (whatever real store eventually holds run history) would
// naturally already have on hand.

import type { PromotionVerdict } from './promotion.js';
import type { EvalRunResult } from './runner.js';

/** One eval run, as a caller's own history would already have it recorded. */
export interface RunHistoryEntry {
  readonly at: Date;
  readonly result: EvalRunResult;
  /** `undefined` for a run nobody ever submitted for promotion (most runs — only a
   * challenger a team actually wants to ship goes through `decidePromotion`). */
  readonly promotionVerdict?: PromotionVerdict;
}

export interface ScorePoint {
  readonly at: Date;
  readonly agentVersion: string;
  readonly passRate: number;
}

export interface CostPoint {
  readonly at: Date;
  readonly agentVersion: string;
  readonly totalCostUsd: number;
  readonly totalTokens: number;
}

export interface ChampionHistoryEntry {
  readonly at: Date;
  readonly agentVersion: string;
  readonly promoted: boolean;
  /** `[]` for a promoted entry — nothing refused it. */
  readonly refusals: readonly { readonly code: string; readonly detail: string }[];
}

export interface AgentDashboard {
  readonly agentId: string;
  readonly scoreOverTime: readonly ScorePoint[];
  readonly costOverTime: readonly CostPoint[];
  /** Only the runs that were actually submitted for promotion — a dashboard's "champion
   * history" is about promotion decisions, not every run an agent ever had. */
  readonly championHistory: readonly ChampionHistoryEntry[];
}

/** Assembles `AgentDashboard` for `agentId` from `history`, oldest first (the order a time
 * series is drawn in). Every entry must actually belong to `agentId` — a caller mixing
 * runs from more than one agent into one history is a real bug, refused rather than
 * silently producing a chart that mislabels whose scores they are. */
export function buildAgentDashboard(
  agentId: string,
  history: readonly RunHistoryEntry[],
): AgentDashboard {
  const wrongAgent = history.find((entry) => entry.result.agentId !== agentId);
  if (wrongAgent !== undefined) {
    throw new RangeError(
      `Run at ${wrongAgent.at.toISOString()} belongs to agent "${wrongAgent.result.agentId}", ` +
        `not "${agentId}".`,
    );
  }

  const sorted = [...history].sort((a, b) => a.at.getTime() - b.at.getTime());

  const scoreOverTime: ScorePoint[] = sorted.map((entry) => ({
    at: entry.at,
    agentVersion: entry.result.agentVersion,
    passRate: entry.result.metrics.passRate,
  }));

  const costOverTime: CostPoint[] = sorted.map((entry) => ({
    at: entry.at,
    agentVersion: entry.result.agentVersion,
    totalCostUsd: entry.result.metrics.totalCostUsd,
    totalTokens: entry.result.metrics.totalTokens,
  }));

  const championHistory: ChampionHistoryEntry[] = sorted
    .filter((entry) => entry.promotionVerdict !== undefined)
    .map((entry) => {
      const verdict = entry.promotionVerdict!;
      return {
        at: entry.at,
        agentVersion: entry.result.agentVersion,
        promoted: verdict.promote,
        refusals: verdict.promote ? [] : verdict.refusals,
      };
    });

  return { agentId, scoreOverTime, costOverTime, championHistory };
}
