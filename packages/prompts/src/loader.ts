// The Prompt Registry's loader — Stage 06 step 3.
//
// "Prompts live in `packages/prompts/src/<agent-id>/<semver>.prompt.md` with front-matter
// (`agent`, `version`, `model`, `changelog`, `author`, `ratified_by`)." Part 3.1 mandates
// the body's own structure: eight sections, in this exact order, nothing missing and
// nothing extra — "omitting a section fails registry validation."
//
// Front matter here is deliberately not parsed with a general YAML library: every prompt
// file in this repo is hand-authored to Part 3.1's own flat `key: value` shape (one
// exception, `ratified_by: null`), never arbitrary external YAML, so a small purpose-built
// parser is what "check whether something already in the tree does the job" (rule 9)
// argues for — nothing already in the tree parses YAML, and this format doesn't need one.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { LogicalModel } from '@infinite-ai/contracts';
import { z } from 'zod';

/** Part 3.1's eight mandatory sections, in the order the manual gives them. Nothing else
 * may appear as a top-level (`# `) heading — "omitting a section fails registry
 * validation," and reordering one is exactly as much an omission as leaving it out. */
export const PROMPT_SECTIONS = [
  'ROLE',
  'GROUNDING',
  'TASK',
  'HARD CONSTRAINTS',
  'STYLE',
  'REFUSAL',
  'OUTPUT SCHEMA',
  'SELF-CHECK',
] as const;

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SEMVER_MESSAGE = 'version must be a semver string (x.y.z)';

export const PromptFrontMatter = z.object({
  agent: z.string().min(1),
  version: z.string().regex(SEMVER_PATTERN, SEMVER_MESSAGE),
  /** A logical model name — never a concrete provider model, the same rule
   * `@infinite-ai/agents`' `AgentContract.model` already holds itself to. */
  model: LogicalModel,
  changelog: z.string().min(1),
  author: z.string().min(1),
  /** Who ratified this version, or `null` if nobody has yet. Ratification is a human
   * decision recorded here, never inferred from the prompt content itself. */
  ratified_by: z.string().min(1).nullable(),
});
export type PromptFrontMatter = z.infer<typeof PromptFrontMatter>;

export class PromptLoadError extends Error {
  public override readonly name = 'PromptLoadError';
  constructor(message: string) {
    super(message);
  }
}

export interface LoadedPrompt {
  readonly frontMatter: PromptFrontMatter;
  readonly body: string;
  /** sha256 of the whole file's raw content — front matter and body both count, so
   * editing either without a version bump is caught the same way. */
  readonly hash: string;
}

export function hashPromptContent(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontMatterBlock(
  block: string,
  sourceLabel: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      throw new PromptLoadError(
        `${sourceLabel}: malformed front-matter line (expected "key: value"): "${line}"`,
      );
    }
    const key = trimmed.slice(0, colonIndex).trim();
    const rawValue = trimmed.slice(colonIndex + 1).trim();
    result[key] = rawValue === 'null' ? null : stripQuotes(rawValue);
  }
  return result;
}

function stripQuotes(value: string): string {
  const isQuoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  return isQuoted ? value.slice(1, -1) : value;
}

function validateSections(body: string, sourceLabel: string): void {
  const headers = [...body.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1]!.trim());
  const required: readonly string[] = PROMPT_SECTIONS;
  const matches =
    headers.length === required.length && headers.every((h, i) => h === required[i]);
  if (!matches) {
    throw new PromptLoadError(
      `${sourceLabel}: must contain exactly these sections, in this order: ` +
        `${required.join(', ')}. Found: ${headers.length > 0 ? headers.join(', ') : '(none)'}.`,
    );
  }
}

/** Parses and validates raw prompt file content — front matter, mandatory section
 * structure, and the content hash. Does not know its own file path; `loadPromptFile`
 * layers the filename/directory-encode-version-and-agent check on top of this. */
export function parsePromptFile(raw: string, sourceLabel: string): LoadedPrompt {
  const match = FRONT_MATTER_PATTERN.exec(raw);
  if (match === null) {
    throw new PromptLoadError(
      `${sourceLabel}: missing front matter (expected a leading "---" block).`,
    );
  }
  const [, frontMatterBlock, body] = match;
  const rawFrontMatter = parseFrontMatterBlock(frontMatterBlock!, sourceLabel);
  const frontMatterResult = PromptFrontMatter.safeParse(rawFrontMatter);
  if (!frontMatterResult.success) {
    throw new PromptLoadError(
      `${sourceLabel}: front matter failed validation: ${frontMatterResult.error.message}`,
    );
  }
  validateSections(body!, sourceLabel);
  return {
    frontMatter: frontMatterResult.data,
    body: body!,
    hash: hashPromptContent(raw),
  };
}

/**
 * Loads one prompt file from disk, and additionally checks what only a real path can:
 * that the front matter's own `version` matches the filename and `agent` matches the
 * directory — `packages/prompts/src/<agent-id>/<semver>.prompt.md`, both ends agreeing
 * with what the file itself declares.
 */
export function loadPromptFile(filePath: string): LoadedPrompt {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = parsePromptFile(raw, filePath);

  const expectedVersion = path.basename(filePath, '.prompt.md');
  if (parsed.frontMatter.version !== expectedVersion) {
    throw new PromptLoadError(
      `${filePath}: front matter version "${parsed.frontMatter.version}" does not match ` +
        `the filename ("${expectedVersion}.prompt.md").`,
    );
  }
  const expectedAgent = path.basename(path.dirname(filePath));
  if (parsed.frontMatter.agent !== expectedAgent) {
    throw new PromptLoadError(
      `${filePath}: front matter agent "${parsed.frontMatter.agent}" does not match its ` +
        `directory ("${expectedAgent}").`,
    );
  }
  return parsed;
}

/** Every `*.prompt.md` file under `rootDir`, recursively, sorted for a deterministic
 * order. Returns an empty list for a directory that does not exist yet — scanning a tree
 * with no prompts in it yet is not an error. */
export function scanPromptFiles(rootDir: string): readonly string[] {
  if (!existsSync(rootDir)) return [];
  return readdirSync(rootDir, { recursive: true })
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.endsWith('.prompt.md'),
    )
    .map((entry) => path.join(rootDir, entry))
    .sort();
}
