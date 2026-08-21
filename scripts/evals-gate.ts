#!/usr/bin/env tsx
/**
 * The CI regression gate — Stage 07 step 5. `pnpm evals:gate`
 *
 * For every agent with both a golden set on disk and a registered executor, runs the set,
 * loads the stored champion result (`packages/evals/champions/<agent-id>.json`) as the
 * baseline, and evaluates `evaluateGate` (a declared 5-percentage-point pass-rate
 * tolerance, and zero tolerance for any `must_not_regress` case). An agent with no stored
 * champion yet gates trivially — there is nothing to regress against on a first run, the
 * same shape `evaluateGate` and `decidePromotion` both already give a `null` baseline.
 *
 * This intentionally always evaluates every known set rather than computing which files
 * changed and narrowing to `affectedAgentIds` — `packages/evals/src/affected.ts` builds
 * and proves that classification for a real caller to use, but wiring an actual `git diff`
 * lookup into this script is not worth the fragility for a build where the full set is
 * still fast to run in full. That narrowing is a legitimate future optimisation, not a gap
 * in what this gate checks today.
 *
 * Exit codes:
 *   0  every gated agent passed (including "nothing to gate yet")
 *   1  at least one agent regressed beyond its declared tolerance
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluateGate,
  getAgentExecutor,
  loadAllEvalSets,
  loadChampionResult,
  runEvalSet,
} from '@infinite-ai/evals';

import './register-ce-executors.js';

const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const DIM = '[2m';
const RESET = '[0m';

const TOLERANCE = { maxPassRateDrop: 0.05 };

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const setsRoot = path.join(repoRoot, 'packages', 'evals', 'sets');
const championsRoot = path.join(repoRoot, 'packages', 'evals', 'champions');

async function main(): Promise<void> {
  const sets = loadAllEvalSets(setsRoot);

  if (sets.size === 0) {
    console.log(
      `${DIM}No golden sets found under ${setsRoot} — nothing to gate.${RESET}`,
    );
    return;
  }

  let failed = false;
  let gatedAny = false;

  for (const [agentId, cases] of sets) {
    if (cases.length === 0) continue;
    const executeAgent = getAgentExecutor(agentId);
    if (executeAgent === undefined) {
      console.log(`${YELLOW}${agentId}: no executor registered — skipped.${RESET}`);
      continue;
    }

    gatedAny = true;
    const current = await runEvalSet(agentId, 'current', cases, { executeAgent });
    const baseline = loadChampionResult(championsRoot, agentId);
    const verdict = evaluateGate(current, baseline, TOLERANCE);

    if (verdict.ok) {
      console.log(
        `${GREEN}${agentId}: gate passed${baseline === null ? ' (no baseline yet)' : ''}.${RESET}`,
      );
    } else {
      failed = true;
      console.error(`${RED}${agentId}: gate failed.${RESET}`);
      for (const refusal of verdict.refusals) {
        console.error(`  ${RED}✗${RESET} [${refusal.code}] ${refusal.detail}`);
      }
    }
  }

  if (!gatedAny) {
    console.log(
      `${DIM}No agent had both a golden set and a registered executor — nothing to gate.${RESET}`,
    );
  }

  if (failed) {
    console.error(
      `\n${RED}Regression beyond declared tolerance. Failing the build.${RESET}`,
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
