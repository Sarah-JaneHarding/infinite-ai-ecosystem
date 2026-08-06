// The eval runner — Stage 07 step 3.
//
// "Implement the runner: run an agent version against a set, produce per-case scores,
// aggregate metrics, a diff against the current champion, and a cost report." Four things,
// built as three: `runEvalSet` runs a set and produces per-case scores plus aggregate
// metrics (which already is the cost report — `RunMetrics`'s own `totalTokens`/
// `totalCostUsd`, alongside every case's own); `diffAgainstChampion` is the separate
// comparison the manual's own text asks for. Neither one decides what a diff *means* for
// promotion — "beats the champion," "regresses a must_not_regress case" — that is step 4's
// job, kept out of this file on purpose: a runner that also decided promotion would be
// answering a question this step does not ask.
//
// `executeAgent` is injected, the same "mechanism now, real wiring once the source exists"
// shape every runnable-thing in this build has used since `StepExecutor`
// (`packages/orchestrator`) and `AgentExecutor` here play the identical role: no module's
// agent has a real implementation yet (Stage 08 is the first one), so there is nothing
// concrete to call. A case whose executor throws is not the run failing — it is one more
// scored case, `passed: false`, `error` set to what went wrong, the same "score it, don't
// crash the run" reasoning `scorers.ts` already gives for a structurally-wrong output.

import type { EvalCase } from './case.js';
import { scoreExpectation, type ScoreOptions, type ScoreResult } from './scorers.js';

/** Runs one agent call for `evalCase.input`/`evalCase.context` and returns its output plus
 * whatever usage it can report. Throwing means the call itself failed — the runner scores
 * that as a failed case rather than crashing the whole set, the same boundary
 * `packages/orchestrator`'s own `StepExecutor` draws between a step's own failure and the
 * runner's handling of it. */
export type AgentExecutor = (evalCase: EvalCase) => Promise<{
  readonly output: unknown;
  readonly tokensUsed?: number;
  readonly costUsd?: number;
}>;

export interface CaseResult {
  readonly caseId: string;
  readonly agentId: string;
  readonly tags: readonly string[];
  /** `true` only if the executor succeeded and every expectation on the case passed. */
  readonly passed: boolean;
  readonly expectationResults: readonly ScoreResult[];
  readonly output: unknown;
  readonly tokensUsed: number | null;
  readonly costUsd: number | null;
  readonly latencyMs: number;
  /** Set when `executeAgent` itself threw — `expectationResults` is empty in that case,
   * since there was no output to score anything against. */
  readonly error: string | null;
}

export interface RunMetrics {
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  /** `0` when `totalCases` is `0` — an empty set has nothing to report a rate for, not a
   * divide-by-zero `NaN`. */
  readonly passRate: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  readonly totalLatencyMs: number;
}

export interface EvalRunResult {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly cases: readonly CaseResult[];
  readonly metrics: RunMetrics;
}

export class EvalRunnerError extends Error {
  public override readonly name = 'EvalRunnerError';
  constructor(message: string) {
    super(message);
  }
}

export interface RunEvalSetOptions extends ScoreOptions {
  readonly executeAgent: AgentExecutor;
  /** Injectable for deterministic latency in tests; defaults to the real clock. */
  readonly now?: () => number;
}

function computeMetrics(cases: readonly CaseResult[]): RunMetrics {
  const totalCases = cases.length;
  const passedCases = cases.filter((c) => c.passed).length;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalLatencyMs = 0;
  for (const c of cases) {
    totalTokens += c.tokensUsed ?? 0;
    totalCostUsd += c.costUsd ?? 0;
    totalLatencyMs += c.latencyMs;
  }
  return {
    totalCases,
    passedCases,
    failedCases: totalCases - passedCases,
    passRate: totalCases === 0 ? 0 : passedCases / totalCases,
    totalTokens,
    totalCostUsd,
    totalLatencyMs,
  };
}

async function runOneCase(
  evalCase: EvalCase,
  options: RunEvalSetOptions,
): Promise<CaseResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();

  let executed: Awaited<ReturnType<AgentExecutor>>;
  try {
    executed = await options.executeAgent(evalCase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      caseId: evalCase.id,
      agentId: evalCase.agentId,
      tags: evalCase.tags,
      passed: false,
      expectationResults: [],
      output: undefined,
      tokensUsed: null,
      costUsd: null,
      latencyMs: now() - startedAt,
      error: message,
    };
  }

  const scoreOptions: ScoreOptions = {
    ...(evalCase.rubric !== undefined && { rubric: evalCase.rubric }),
    ...(options.judge !== undefined && { judge: options.judge }),
    ...(options.templateFidelityCheckers !== undefined && {
      templateFidelityCheckers: options.templateFidelityCheckers,
    }),
  };
  const expectationResults = await Promise.all(
    evalCase.expectations.map((expectation) =>
      scoreExpectation(expectation, executed.output, scoreOptions),
    ),
  );

  return {
    caseId: evalCase.id,
    agentId: evalCase.agentId,
    tags: evalCase.tags,
    passed: expectationResults.every((r) => r.passed),
    expectationResults,
    output: executed.output,
    tokensUsed: executed.tokensUsed ?? null,
    costUsd: executed.costUsd ?? null,
    latencyMs: now() - startedAt,
    error: null,
  };
}

/**
 * Runs every case in `cases` against `agentId`@`agentVersion` and returns per-case scores
 * plus aggregate metrics (the cost report is `metrics.totalTokens`/`totalCostUsd`,
 * alongside each case's own). Every case must declare `agentId` — a set built for the
 * wrong agent is a real bug, refused rather than silently scored against the wrong thing.
 * Cases run sequentially: eval sets are not large enough yet to need the concurrency
 * limits `packages/orchestrator`'s own runner has real reasons for, and sequential keeps a
 * cost report honest about what a single evaluation pass actually spent, without a
 * concurrency-limiter dependency this step does not need yet.
 */
export async function runEvalSet(
  agentId: string,
  agentVersion: string,
  cases: readonly EvalCase[],
  options: RunEvalSetOptions,
): Promise<EvalRunResult> {
  const wrongAgent = cases.find((c) => c.agentId !== agentId);
  if (wrongAgent !== undefined) {
    throw new EvalRunnerError(
      `Case "${wrongAgent.id}" declares agentId "${wrongAgent.agentId}", not "${agentId}" ` +
        `— an eval set must be built for exactly one agent.`,
    );
  }

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    results.push(await runOneCase(evalCase, options));
  }

  return {
    agentId,
    agentVersion,
    cases: results,
    metrics: computeMetrics(results),
  };
}

export interface CaseDiff {
  readonly caseId: string;
  readonly tags: readonly string[];
  /** `null` when the champion run has no result for this case — a case added since the
   * champion's own last run, not a regression or an improvement. */
  readonly championPassed: boolean | null;
  readonly challengerPassed: boolean;
  readonly regressed: boolean;
  readonly improved: boolean;
}

export interface RunDiff {
  readonly cases: readonly CaseDiff[];
  readonly regressedCaseIds: readonly string[];
  readonly improvedCaseIds: readonly string[];
  /** Cases the challenger run has that the champion run did not. */
  readonly newCaseIds: readonly string[];
}

/**
 * Diffs `challenger` against `champion` — which cases regressed (passed under the champion,
 * failed under the challenger), which improved (the reverse), and which are new (no
 * champion result to compare against). `champion === null` means there is no champion yet
 * (this agent's first ever run): every case is new, nothing regresses or improves, since
 * there is nothing to compare against. Deciding what a regression *means* for whether the
 * challenger may be promoted — the `must_not_regress` tag's own rule — is step 4's job;
 * this only reports what changed, per case, so that decision has real data to work from.
 */
export function diffAgainstChampion(
  challenger: EvalRunResult,
  champion: EvalRunResult | null,
): RunDiff {
  const championByCaseId = new Map(champion?.cases.map((c) => [c.caseId, c]) ?? []);

  const cases: CaseDiff[] = challenger.cases.map((challengerCase) => {
    const championCase = championByCaseId.get(challengerCase.caseId);
    const championPassed = championCase?.passed ?? null;
    const regressed = championPassed === true && !challengerCase.passed;
    const improved = championPassed === false && challengerCase.passed;
    return {
      caseId: challengerCase.caseId,
      tags: challengerCase.tags,
      championPassed,
      challengerPassed: challengerCase.passed,
      regressed,
      improved,
    };
  });

  return {
    cases,
    regressedCaseIds: cases.filter((c) => c.regressed).map((c) => c.caseId),
    improvedCaseIds: cases.filter((c) => c.improved).map((c) => c.caseId),
    newCaseIds: cases.filter((c) => c.championPassed === null).map((c) => c.caseId),
  };
}
