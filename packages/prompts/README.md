# @infinite-ai/prompts

The Prompt Registry: versioned, content-hashed prompt sources and the loader that reads
them. Every agent's prompt is a file, not a string embedded in code — that is what makes
"prompt versioned in the Prompt Registry" (Definition of Done) a real, checkable claim.

## What's here

- Prompt source files themselves, one directory per agent id
  (`src/<AGENT-ID>/<semver>.prompt.md`), each with front-matter (`agent`, `version`,
  `model`, `changelog`, `author`, `ratified_by`) and the build manual's eight mandatory
  sections (`ROLE`, `GROUNDING`, `TASK`, `HARD CONSTRAINTS`, `STYLE`, `REFUSAL`,
  `OUTPUT SCHEMA`, `SELF-CHECK`), in that fixed order.
- `loader.ts` — `loadPromptFile()` / `parsePromptFile()` / `scanPromptFiles()`, and
  `hashPromptContent()`, the content hash `packages/prompt-builder` treats as the
  identity of a specific prompt version.
- `lock.ts` — `buildPromptLock()` / `verifyPromptLock()`: `prompt-lock.json` (checked
  into the repo) records each prompt's expected hash, so an edit-in-place without a
  version bump is caught by CI rather than silently accepted.

## Where it fits

L6 (the agent runtime) in the `CLAUDE.md` architecture. `packages/prompt-builder`
assembles a `LoadedPrompt` from here into the final system/user message split;
`packages/agents`' registry refuses to boot an agent whose declared prompt ref does not
resolve to a real file here.

## Running its tests

```bash
pnpm --filter @infinite-ai/prompts test
```

Unit tier only — parses and hashes real prompt files, no model calls.
