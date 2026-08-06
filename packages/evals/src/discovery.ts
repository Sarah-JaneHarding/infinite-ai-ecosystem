// Golden-set discovery — Stage 07 step 5.
//
// "Wire CI: on any change to a prompt, agent, guardrail or retrieval code, run the
// affected eval sets." Before anything can run, it has to be found. Golden sets live as
// plain JSON files under `packages/evals/sets/<agent-id>/*.json`, one file holding one
// array of cases — a human-editable format (rather than, say, a database table) because a
// golden set is reviewed the way a prompt is: in a diff, in a pull request, by a person who
// is not this codebase. Every file is validated through `validateEvalCase` on load — the
// same "unknown plus a Zod parse" boundary every other contract in this codebase uses — so
// a malformed case fails the moment it is discovered, not partway through a run.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { validateEvalCase, type EvalCase } from './case.js';

export class EvalDiscoveryError extends Error {
  public override readonly name = 'EvalDiscoveryError';
  constructor(message: string) {
    super(message);
  }
}

/** Loads and validates every `*.json` file directly under `dir` — each file is one JSON
 * array of eval cases. Returns `[]` for a directory that does not exist yet: an agent with
 * no golden set on disk has an empty set, not a missing one. */
export function loadEvalCasesFromDir(dir: string): readonly EvalCase[] {
  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const cases: EvalCase[] = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    const filePath = path.join(dir, entry);
    const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(raw)) {
      throw new EvalDiscoveryError(
        `${filePath} must contain a JSON array of eval cases.`,
      );
    }
    for (const [index, candidate] of raw.entries()) {
      try {
        cases.push(validateEvalCase(candidate));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new EvalDiscoveryError(`${filePath}[${index}]: ${message}`);
      }
    }
  }
  return cases;
}

/** One golden set per subdirectory of `setsRoot`, keyed by directory name (the agent id by
 * convention — not enforced here, since a case's own `agentId` is what every consumer
 * actually checks against; the directory name is only a human-navigable grouping). */
export function loadAllEvalSets(
  setsRoot: string,
): ReadonlyMap<string, readonly EvalCase[]> {
  let agentDirs: readonly string[];
  try {
    agentDirs = readdirSync(setsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return new Map();
  }

  const sets = new Map<string, readonly EvalCase[]>();
  for (const agentDir of [...agentDirs].sort()) {
    sets.set(agentDir, loadEvalCasesFromDir(path.join(setsRoot, agentDir)));
  }
  return sets;
}
