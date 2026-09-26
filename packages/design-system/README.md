# @infinite-ai/design-system

Design tokens, components, and the infinity mark — the shared visual language behind
`apps/web`'s role-scoped UIs.

## What's here

- `tokens.ts` / `tokens.css` — `COLORS`, `SPECTRUM`, `FONTS`, `SPACE`, `RADIUS`, `MOTION`,
  `CARD_GRADIENT`, `STATUS_COLORS`.
- `components/` — `InfinityMark`, `Button`, `Card`/`ModularCard` (the card used per role
  hue — see `apps/web/src/lib/roles.ts`'s `ROLE_HUE`), `Badge`, `StatusPill`.

## Where it fits

L8 (experience surfaces) in the `CLAUDE.md` architecture. `apps/web` is this package's
only consumer today — every role-scoped page composes its UI from these tokens and
components rather than defining its own colours or spacing.

## Running its tests

```bash
pnpm --filter @infinite-ai/design-system test
```

Unit tier only (token values and component export shape) — no browser or visual-regression
tier exists yet for this package.
