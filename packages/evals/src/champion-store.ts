// The champion result store — Stage 07 step 5.
//
// The CI gate (`evaluateGate`) and the promotion gate (`decidePromotion`) both need a
// baseline `EvalRunResult` to compare against — "the last known-good run for this agent."
// This is a plain JSON file per agent under `packages/evals/champions/<agent-id>.json`,
// the same "human-editable, reviewed in a diff" reasoning `discovery.ts`'s own header
// already gives for golden sets living as files rather than in a database: a champion
// result changing is itself a fact worth a commit message, not a row update nobody sees.
// `packages/db` is not involved — this package has no dependency on it, and a champion
// result is not tenant data, so there is nothing here for row-level security to apply to.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { EvalRunResult } from './runner.js';

/** Reads the stored champion result for `agentId` from `championsRoot`, or `null` if none
 * has ever been recorded — the correct input for a first-ever run, where `evaluateGate`
 * and `decidePromotion` both already treat `null` as "nothing to compare against" rather
 * than a missing file being an error. */
export function loadChampionResult(
  championsRoot: string,
  agentId: string,
): EvalRunResult | null {
  const filePath = path.join(championsRoot, `${agentId}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8')) as EvalRunResult;
}

/** Persists `result` as the new champion for its own `agentId` — overwriting whatever was
 * there before, the same "a promotion replaces the champion outright" semantics
 * `decidePromotion`'s own name already implies. Creates `championsRoot` if it does not
 * exist yet, since the very first promotion for a fresh repo has nowhere to write into. */
export function saveChampionResult(championsRoot: string, result: EvalRunResult): void {
  mkdirSync(championsRoot, { recursive: true });
  const filePath = path.join(championsRoot, `${result.agentId}.json`);
  writeFileSync(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
