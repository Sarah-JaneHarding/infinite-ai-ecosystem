// Master Prompt Builder — Stage 20.
//
// Takes a LoadedPrompt from the registry, applies variable substitution, then splits
// the assembled body into the two parts the gateway needs:
//
//   system   — ROLE, HARD CONSTRAINTS, STYLE, REFUSAL, OUTPUT SCHEMA, SELF-CHECK
//              These define the agent's identity and rules; they are stable across
//              invocations of the same agent version.
//
//   userTurn — GROUNDING, TASK
//              These carry the per-request context retrieved from the Brain and the
//              specific instruction for this invocation.
//
// The split follows Part 3.1 of the build manual: the eight mandatory sections are
// in a fixed order; the builder identifies each by its `# SECTION` heading.

import { type LoadedPrompt, PROMPT_SECTIONS } from '@infinite-ai/prompts';

import { type PromptBudget, DEFAULT_BUDGET, enforceBudget } from './budget.js';
import { type VariableMap, substituteVariables } from './variables.js';

// Sections that belong in the gateway system prompt.
const SYSTEM_SECTIONS = new Set<string>([
  'ROLE',
  'HARD CONSTRAINTS',
  'STYLE',
  'REFUSAL',
  'OUTPUT SCHEMA',
  'SELF-CHECK',
]);

// Sections that belong in the user turn.
const USER_SECTIONS = new Set<string>(['GROUNDING', 'TASK']);

export class PromptBuildError extends Error {
  public override readonly name = 'PromptBuildError';
  constructor(message: string) {
    super(message);
  }
}

/** The result of assembling a prompt: two strings ready for the gateway. */
export interface BuiltPrompt {
  /** Assembled from ROLE, HARD CONSTRAINTS, STYLE, REFUSAL, OUTPUT SCHEMA, SELF-CHECK. */
  readonly system: string;
  /** Assembled from GROUNDING and TASK, in that order. */
  readonly userTurn: string;
  /** The agent id + version this was built from, e.g. "CE-03@1.0.0". */
  readonly source: string;
  /** The maximum tokens to request from the model (from the budget). */
  readonly maxOutputTokens: number;
}

/**
 * Builds a gateway-ready prompt from a loaded registry entry.
 *
 * @param prompt    — a prompt loaded and validated by `@infinite-ai/prompts`
 * @param variables — values for every `{{placeholder}}` in the prompt body
 * @param budget    — token limits; defaults to DEFAULT_BUDGET
 */
export function buildPrompt(
  prompt: LoadedPrompt,
  variables: VariableMap = {},
  budget: PromptBudget = DEFAULT_BUDGET,
): BuiltPrompt {
  const substituted = substituteVariables(prompt.body, variables);
  const sections = parseSections(substituted, prompt.frontMatter.agent);

  const systemParts: string[] = [];
  const userParts: string[] = [];

  for (const sectionName of PROMPT_SECTIONS) {
    const body = sections.get(sectionName);
    if (body === undefined) {
      throw new PromptBuildError(
        `Prompt "${prompt.frontMatter.agent}@${prompt.frontMatter.version}" is missing ` +
          `section "${sectionName}" after variable substitution.`,
      );
    }
    const block = `# ${sectionName}\n\n${body.trim()}`;
    if (SYSTEM_SECTIONS.has(sectionName)) {
      systemParts.push(block);
    } else if (USER_SECTIONS.has(sectionName)) {
      userParts.push(block);
    }
  }

  const system = systemParts.join('\n\n');
  const userTurn = userParts.join('\n\n');

  enforceBudget(system, userTurn, budget);

  return {
    system,
    userTurn,
    source: `${prompt.frontMatter.agent}@${prompt.frontMatter.version}`,
    maxOutputTokens: budget.maxOutputTokens,
  };
}

/**
 * Parses the eight mandatory sections out of an assembled prompt body.
 * Returns a Map of section name → section body text (excluding the heading line).
 * Throws PromptBuildError if the section count does not match expectations.
 */
function parseSections(body: string, agentId: string): Map<string, string> {
  const result = new Map<string, string>();
  const sectionPattern = new RegExp(`^# (${PROMPT_SECTIONS.join('|')})[ \t]*$`, 'gm');

  // Collect all heading positions first, then slice the body between them.
  const matches: Array<{ section: string; start: number; headingEnd: number }> = [];
  for (const match of body.matchAll(sectionPattern)) {
    matches.push({
      section: match[1]!,
      start: match.index!,
      headingEnd: match.index! + match[0]!.length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.start : body.length;
    const sectionBody = body.slice(current.headingEnd, nextStart).trim();
    result.set(current.section, sectionBody);
  }

  if (result.size !== PROMPT_SECTIONS.length) {
    const found = Array.from(result.keys()).join(', ');
    throw new PromptBuildError(
      `Prompt "${agentId}": expected ${PROMPT_SECTIONS.length} sections, ` +
        `found ${result.size}. Sections found: ${found || '(none)'}.`,
    );
  }

  return result;
}
