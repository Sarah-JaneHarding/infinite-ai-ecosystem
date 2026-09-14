// @infinite-ai/prompts — Prompt Registry: versioned, content-hashed prompt sources and loader.
//
// Step 3 (loader.ts, lock.ts): prompts live at
// packages/prompts/src/<agent-id>/<semver>.prompt.md, with front-matter (agent, version,
// model, changelog, author, ratified_by) and Part 3.1's eight mandatory sections in order.
// The loader parses and content-hashes a prompt file; `prompt-lock.json` (checked in,
// starts empty — no real prompt exists yet) is what a real prompt's hash is compared
// against once one does, so an edit-in-place without a version bump is caught rather than
// silently accepted.

export {
  PROMPT_SECTIONS,
  PromptFrontMatter,
  PromptLoadError,
  hashPromptContent,
  loadPromptFile,
  parsePromptFile,
  scanPromptFiles,
  type LoadedPrompt,
} from './loader.js';

export {
  buildPromptLock,
  verifyPromptLock,
  type PromptLock,
  type PromptLockViolation,
  type PromptLockViolationReason,
} from './lock.js';

export const PACKAGE_NAME = '@infinite-ai/prompts' as const;
