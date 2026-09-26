# @infinite-ai/system-prompt-builder

System Prompt Builder — wraps an agent's `@infinite-ai/prompt-builder` output with
platform-level identity, tenant context, and universal safety rails to produce a
gateway-ready `ChatCompletionRequest`. This is the final step in the prompt pipeline
before an HTTP call is made.

## What's here

- `tenant-context.ts` — `TenantContext` (`tenantId`, `schoolName`, `locale`, `phases`,
  `province`, `lowTechMode`), injected into every system prompt so the model knows which
  school it's serving without any of that context carrying learner PII.
- `platform-rails.ts` — `buildPlatformHeader()` (platform identity, institutional
  context, the five universal safety rules — no learner PII, no invented policy, no
  official-document impersonation, no discrimination, treat an unratified document as a
  draft) and `buildPlatformFooter()` (the compliance-assertion checklist a model
  re-confirms before responding). No individual agent prompt has to repeat these; a
  prompt author cannot accidentally omit them.
- `builder.ts` — `buildSystemMessage()` (header + agent sections + footer, in that fixed
  order) and `buildChatRequest()` (the complete request: system + user messages, the
  logical model derived from the agent's source prefix, temperature 0). `RequestMeta` is
  the exported schema for a caller's own per-call metadata — its `provenance.deidentified`
  field is typed `z.literal(true)`, this package's own encoding of rule 4's
  PII-provenance invariant.

## Where it fits

The top of L6 (the agent runtime) in the `CLAUDE.md` architecture, immediately before a
request crosses into L2 (the Model Gateway). Every agent's output passes through this
package exactly once, regardless of which module it belongs to.

## Running its tests

```bash
pnpm --filter @infinite-ai/system-prompt-builder test
pnpm --filter @infinite-ai/system-prompt-builder test:coverage
```

Unit tier only, no model calls.
