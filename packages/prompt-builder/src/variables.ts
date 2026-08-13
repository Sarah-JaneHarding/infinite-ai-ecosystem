// Variable extraction and substitution — Stage 20 (Master Prompt Builder).
//
// Prompt files may contain `{{variable_name}}` placeholders in any section.
// This module extracts the set of placeholders from a prompt body, validates
// that all required ones are supplied, and substitutes values in.
//
// Variable names must match /^[a-z][a-z0-9_]*$/ — lower-snake-case only,
// matching the naming convention for structured context keys in the prompt files.

import { z } from 'zod';

/** Regex that matches every `{{variable_name}}` placeholder in a string. */
const PLACEHOLDER_PATTERN = /\{\{([a-z][a-z0-9_]*)\}\}/g;

/** Zod schema for a single variable name. */
export const VariableName = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'variable names must be lower-snake-case');

/** A flat map of variable names to their string-serialised values. */
export type VariableMap = Readonly<Record<string, string>>;

export class PromptVariableError extends Error {
  public override readonly name = 'PromptVariableError';
  constructor(
    message: string,
    public readonly missing: readonly string[],
    public readonly unknown: readonly string[],
  ) {
    super(message);
  }
}

/**
 * Returns the set of unique placeholder names found in `text`, in insertion order.
 * Only well-formed `{{lower_snake_case}}` tokens are returned; malformed tokens
 * (e.g. `{{Bad}}`, `{{two words}}`) are ignored — the pattern simply won't match.
 */
export function extractVariables(text: string): readonly string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    seen.add(match[1]!);
  }
  return Array.from(seen);
}

/**
 * Substitutes every `{{name}}` placeholder in `text` with the corresponding value
 * from `variables`. Throws `PromptVariableError` if:
 *   - A placeholder found in `text` has no entry in `variables` (missing).
 *   - A key in `variables` matches no placeholder in `text` (unknown / typo guard).
 */
export function substituteVariables(text: string, variables: VariableMap): string {
  const required = extractVariables(text);
  const supplied = new Set(Object.keys(variables));

  const missing = required.filter((name) => !supplied.has(name));
  const unknown = Array.from(supplied).filter((name) => !required.includes(name));

  if (missing.length > 0 || unknown.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
    if (unknown.length > 0) parts.push(`unknown: ${unknown.join(', ')}`);
    throw new PromptVariableError(
      `Prompt variable error — ${parts.join('; ')}`,
      missing,
      unknown,
    );
  }

  return text.replace(PLACEHOLDER_PATTERN, (_, name: string) => variables[name]!);
}
