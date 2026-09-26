# @infinite-ai/deident

De-identification and audited re-identification — the primitives a caller uses to
actually de-identify data before attaching the `deidentified: true` provenance stamp
`packages/guardrails`'s PII egress guard checks for. The stamp itself is set by the
caller (see the MOD-01 curriculum agent executors in `packages/curriculum-seed` for the
pattern), not by this package; this package is what makes that stamp true.

## What's here

- `tokenise.ts` — `tokenise()`, replacing a real identifier with an opaque,
  tenant-salted `Token` (`TenantSalt` scopes the salt per tenant, so the same learner
  tokenises to a different value in a different school). `isToken()` / `tokenMatches()`
  let a caller recognise and compare tokens without ever reversing one.
- `scrub.ts` — `scrub()`, which finds and redacts detectable PII in free text against a
  `TenantLexicon` (the school's own name variants, staff names, etc. — the patterns a
  generic regex would miss), returning a `ScrubResult` with the redactions it made and a
  `RedactionKind` for each.

## Where it fits

L5 (the guardrail plane) in the `CLAUDE.md` architecture, alongside `packages/guardrails`
and `packages/policy`. A module package tokenises and scrubs learner data through this
package, then attaches the `deidentified: true` stamp itself, before the payload is ever
passed to `packages/guardrails`'s PII egress guard, which checks for that stamp rather
than re-deriving it.

## Running its tests

```bash
pnpm --filter @infinite-ai/deident test
```

Unit tier only, no external services required.
