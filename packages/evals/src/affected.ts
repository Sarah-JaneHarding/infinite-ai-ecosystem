// Which eval sets a change affects — Stage 07 step 5.
//
// "On any change to a prompt, agent, guardrail or retrieval code, run the affected eval
// sets." Two different kinds of change here: a prompt or agent-contract file names one
// specific agent (its id is part of the path — `packages/prompts/src/<agent-id>/...` or
// `packages/agents/src/**/<agent-id>.contract.ts`), so only that agent's set needs to run.
// A guardrail or retrieval-path change is cross-cutting — every agent's own output passes
// through the guardrail engine and, for agents that read the Brain, through retrieval — so
// it has no one affected agent; every registered set has to run. `classifyChange` is the
// pure per-file decision; `affectedAgentIds` folds a whole changed-file list into one
// answer a CI job can act on directly.

const PROMPT_FILE = /^packages\/prompts\/src\/([^/]+)\//;
// Captures the whole basename before ".contract.ts" — deliberately not `[/-]` as a
// boundary, since an agent id itself commonly contains a hyphen (e.g. "CE-05"), which a
// hyphen-as-boundary match would wrongly split on.
const AGENT_CONTRACT_FILE = /^packages\/agents\/src\/.*\/([A-Za-z0-9-]+)\.contract\.ts$/;
const CROSS_CUTTING_PREFIXES = [
  'packages/guardrails/',
  'packages/brain/',
  'packages/policy/',
  'packages/deident/',
];

export type ChangeImpact =
  | { readonly kind: 'agent'; readonly agentId: string }
  | { readonly kind: 'cross_cutting' }
  | { readonly kind: 'none' };

/** Classifies one changed file path. Order matters: a cross-cutting prefix match is
 * checked first so a guardrail file cannot also be mistaken for a single agent's own
 * prompt just because both live under `packages/`. */
export function classifyChange(filePath: string): ChangeImpact {
  if (CROSS_CUTTING_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return { kind: 'cross_cutting' };
  }
  const promptMatch = PROMPT_FILE.exec(filePath);
  if (promptMatch?.[1] !== undefined) {
    return { kind: 'agent', agentId: promptMatch[1] };
  }
  const contractMatch = AGENT_CONTRACT_FILE.exec(filePath);
  if (contractMatch?.[1] !== undefined) {
    return { kind: 'agent', agentId: contractMatch[1] };
  }
  return { kind: 'none' };
}

/** `'all'` means a cross-cutting file changed — every known agent's eval set runs,
 * regardless of which ones a path match would have named. A specific `string[]` names
 * exactly the agents whose own prompt or contract changed. `[]` means nothing in
 * `changedFiles` affects any eval set at all. */
export function affectedAgentIds(
  changedFiles: readonly string[],
): 'all' | readonly string[] {
  const agentIds = new Set<string>();
  for (const filePath of changedFiles) {
    const impact = classifyChange(filePath);
    if (impact.kind === 'cross_cutting') return 'all';
    if (impact.kind === 'agent') agentIds.add(impact.agentId);
  }
  return [...agentIds];
}
