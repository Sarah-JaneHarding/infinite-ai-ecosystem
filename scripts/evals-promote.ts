#!/usr/bin/env tsx
/**
 * Promotes the current eval run result to the champion baseline for every agent
 * that has both a golden set and a registered executor.
 *
 * `pnpm evals:promote`
 *
 * Run this after a set of executors is confirmed correct (all cases passing)
 * and you want to lock those scores in as the regression baseline for `pnpm evals:gate`.
 * Champions are stored as `packages/evals/champions/<agent-id>.json` and should be
 * committed alongside any change to an executor or golden set.
 *
 * Exit codes:
 *   0  every promotable agent was run and saved (agents with no executor are skipped)
 *   1  at least one agent's eval run produced failing cases — champion not saved for it
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAgentExecutor,
  loadAllEvalSets,
  runEvalSet,
  saveChampionResult,
} from '@infinite-ai/evals';

import './register-ce-executors.js';
import './register-dw-executors.js';
import './register-ac-executors.js';
import './register-tb-executors.js';
import './register-le-executors.js';
import './register-pd-executors.js';
import { acStubJudge } from './ac-stub-judge.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const setsRoot = path.join(repoRoot, 'packages', 'evals', 'sets');
const championsRoot = path.join(repoRoot, 'packages', 'evals', 'champions');

async function main(): Promise<void> {
  const sets = loadAllEvalSets(setsRoot);

  if (sets.size === 0) {
    console.log(
      `${DIM}No golden sets found under ${setsRoot} — nothing to promote.${RESET}`,
    );
    return;
  }

  let failed = false;
  let promotedAny = false;

  for (const [agentId, cases] of sets) {
    if (cases.length === 0) continue;
    const executeAgent = getAgentExecutor(agentId);
    if (executeAgent === undefined) {
      console.log(`${YELLOW}${agentId}: no executor registered — skipped.${RESET}`);
      continue;
    }

    const result = await runEvalSet(agentId, 'current', cases, {
      executeAgent,
      judge: acStubJudge,
    });
    const passRate = result.metrics.passRate;

    if (result.metrics.failedCases > 0) {
      failed = true;
      console.error(
        `${RED}${agentId}: ${result.metrics.failedCases} case(s) failed — champion NOT saved.${RESET}`,
      );
      for (const c of result.cases.filter((c) => !c.passed)) {
        console.error(
          `  ${RED}✗${RESET} ${c.caseId}${c.error !== null ? ` — ${c.error}` : ''}`,
        );
      }
    } else {
      saveChampionResult(championsRoot, result);
      promotedAny = true;
      console.log(
        `${GREEN}${agentId}: promoted — ${result.metrics.passedCases}/${result.metrics.totalCases} ` +
          `(${(passRate * 100).toFixed(1)}%).${RESET}`,
      );
    }
  }

  if (!promotedAny) {
    console.log(
      `${DIM}Nothing was promoted — no agent had both cases and a registered executor.${RESET}`,
    );
  }

  if (failed) {
    console.error(
      `\n${RED}One or more agents had failing cases. Fix them before promoting.${RESET}`,
    );
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(
    `${RED}${error instanceof Error ? error.message : String(error)}${RESET}`,
  );
  process.exit(1);
});
