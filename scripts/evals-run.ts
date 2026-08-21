#!/usr/bin/env tsx
/**
 * Runs golden sets against whatever agent executors are currently registered.
 *
 * `pnpm evals:run --all`            run every discovered set
 * `pnpm evals:run --agent CE-05`    run one agent's own set
 *
 * Golden sets live under `packages/evals/sets/<agent-id>/*.json` (Stage 07 step 5's own
 * `loadAllEvalSets`). An executor is what actually calls the real agent — Stage 08 is the
 * first module with one to register, via `registerAgentExecutor` — so a set with no
 * registered executor is reported and skipped, not failed: there is nothing to run it
 * against yet, and that is an honest, expected state for a build still short of Stage 08,
 * not a broken one.
 *
 * Exit codes:
 *   0  every runnable set ran (skips for a missing executor do not fail the run)
 *   1  a golden-set file itself is malformed
 *   2  usage
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAgentExecutor, loadAllEvalSets, runEvalSet } from '@infinite-ai/evals';

import './register-ce-executors.js';
import './register-dw-executors.js';

const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const DIM = '[2m';
const RESET = '[0m';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const setsRoot = path.join(repoRoot, 'packages', 'evals', 'sets');

function usage(): never {
  console.error('Usage: pnpm evals:run --all | pnpm evals:run --agent <agent-id>');
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const agentFlagIndex = args.indexOf('--agent');
  const oneAgentId = agentFlagIndex === -1 ? undefined : args[agentFlagIndex + 1];
  if (!all && oneAgentId === undefined) usage();

  const sets = loadAllEvalSets(setsRoot);
  const agentIds = all ? [...sets.keys()] : [oneAgentId!];

  if (agentIds.length === 0) {
    console.log(`${DIM}No golden sets found under ${setsRoot}.${RESET}`);
    return;
  }

  let ranAny = false;
  for (const agentId of agentIds) {
    const cases = sets.get(agentId) ?? [];
    if (cases.length === 0) {
      console.log(`${DIM}${agentId}: no golden set on disk — skipped.${RESET}`);
      continue;
    }
    const executeAgent = getAgentExecutor(agentId);
    if (executeAgent === undefined) {
      console.log(
        `${YELLOW}${agentId}: ${cases.length} case(s) found, but no executor is registered ` +
          `— skipped.${RESET}`,
      );
      continue;
    }

    ranAny = true;
    // No case carries its own agent version — a case tests an agent id, not one specific
    // version of it. Real version identification is the caller's own job (e.g. reading it
    // from the registered `AgentContract` once one exists); this CLI has no such registry
    // to consult yet, so it reports the run honestly as against "current".
    const result = await runEvalSet(agentId, 'current', cases, { executeAgent });
    const colour = result.metrics.failedCases === 0 ? GREEN : RED;
    console.log(
      `${colour}${agentId}${RESET}: ${result.metrics.passedCases}/${result.metrics.totalCases} ` +
        `passed (${(result.metrics.passRate * 100).toFixed(1)}%), ` +
        `$${result.metrics.totalCostUsd.toFixed(4)}, ${result.metrics.totalTokens} tokens.`,
    );
    for (const c of result.cases.filter((c) => !c.passed)) {
      console.log(
        `  ${RED}✗${RESET} ${c.caseId}${c.error !== null ? ` — ${c.error}` : ''}`,
      );
    }
  }

  if (!ranAny) {
    console.log(
      `${DIM}Nothing was actually run — no set had both cases and a registered executor.${RESET}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `${RED}${error instanceof Error ? error.message : String(error)}${RESET}`,
  );
  process.exit(1);
});
