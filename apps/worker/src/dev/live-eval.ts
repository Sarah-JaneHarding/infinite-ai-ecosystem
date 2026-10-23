// Runs one agent's golden set against the live gateway and keeps both the scores and the
// raw material a calibration needs.
//
// Two things to know before reading its numbers:
//   * The golden sets were written against the stub executors in `scripts/register-*`, so
//     many expectations describe the stub's deterministic behaviour (e.g. "L0 is empty →
//     needs_input"). A live pass rate is therefore a measure of how a model + prompt
//     behave against those expectations, not a quality score. The raw replies in
//     `calls.jsonl` are the real product of this tool.
//   * `llm_judge` expectations are not scored here (no calibrated judge exists - OQ-016).
//     They are counted as deferred, and a case with nothing else to check is `unscored`.

import {
  runEvalSet,
  type EvalCase,
  type EvalRunResult,
  type AgentExecutor,
} from '@infinite-ai/evals';

import type { AgentCallRecord } from './agent-runner.js';

export type CaseStatus = 'passed' | 'failed' | 'unscored' | 'call_failed';

export interface LiveCaseSummary {
  readonly caseId: string;
  readonly outcome: AgentCallRecord['outcome'];
  readonly status: CaseStatus;
  readonly failedExpectations: readonly string[];
  readonly deferredJudgeExpectations: number;
  readonly latencyMs: number;
  readonly totalTokens: number | null;
}

export interface LiveEvalSummary {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly cases: readonly LiveCaseSummary[];
  readonly counts: Readonly<Record<CaseStatus, number>>;
}

export interface LiveEvalDeps {
  readonly runCase: (evalCase: EvalCase) => Promise<AgentCallRecord>;
  /** Called with every record as soon as it exists, so a crash keeps what was gathered. */
  readonly onRecord?: (record: AgentCallRecord) => void;
}

export async function runLiveEval(
  agentId: string,
  agentVersion: string,
  cases: readonly EvalCase[],
  deps: LiveEvalDeps,
): Promise<LiveEvalSummary> {
  const records = new Map<string, AgentCallRecord>();
  const deferred = new Map<string, number>();

  const scorable = cases.map((evalCase) => {
    const judgeCount = evalCase.expectations.filter((e) => e.type === 'llm_judge').length;
    deferred.set(evalCase.id, judgeCount);
    return {
      ...evalCase,
      expectations: evalCase.expectations.filter((e) => e.type !== 'llm_judge'),
    };
  });

  const executeAgent: AgentExecutor = async (evalCase) => {
    const record = await deps.runCase(evalCase);
    records.set(evalCase.id, record);
    deps.onRecord?.(record);
    if (record.outcome !== 'ok') {
      throw new Error(`${record.outcome}: ${record.error ?? 'no detail'}`);
    }
    return {
      output: record.output,
      ...(record.usage === null ? {} : { tokensUsed: record.usage.totalTokens }),
    };
  };

  const result: EvalRunResult = await runEvalSet(agentId, agentVersion, scorable, {
    executeAgent,
  });

  const summaries = result.cases.map((scored): LiveCaseSummary => {
    const record = records.get(scored.caseId);
    const outcome = record?.outcome ?? 'error';
    const original = cases.find((c) => c.id === scored.caseId);
    const judges = deferred.get(scored.caseId) ?? 0;
    const nothingScored = (original?.expectations.length ?? 0) === judges;
    let status: CaseStatus;
    if (outcome !== 'ok') status = 'call_failed';
    else if (nothingScored) status = 'unscored';
    else status = scored.passed ? 'passed' : 'failed';
    return {
      caseId: scored.caseId,
      outcome,
      status,
      failedExpectations: scored.expectationResults
        .filter((r) => !r.passed)
        .map((r) => r.detail),
      deferredJudgeExpectations: judges,
      latencyMs: scored.latencyMs,
      totalTokens: scored.tokensUsed,
    };
  });

  const counts: Record<CaseStatus, number> = {
    passed: 0,
    failed: 0,
    unscored: 0,
    call_failed: 0,
  };
  for (const summary of summaries) counts[summary.status] += 1;
  return { agentId, agentVersion, cases: summaries, counts };
}
