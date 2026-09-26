# @infinite-ai/low-tech-assessment

Low-tech card-scanning assessment engine (Plickers-style). Pure logic: card generation,
session management, response tallying. No camera, no database, no model calls — those
belong to whichever caller adopts this package.

## What's here

- `cards.ts` — `CardSide` (A/B/C/D), `Card`/`ScanResult`, and `generateCardSet()`: each
  learner gets a physical card (1–`MAX_CARDS`, 40 by default) with a deterministic code;
  no real learner name or ID is stored, only the card number linkage happens outside this
  package after de-identification.
- `session.ts` — `Question` (2–4 options, correct side must be among them, sides must be
  distinct — both enforced by schema `.refine()`s) and `AssessmentSession`'s lifecycle
  (`startSession`/`advanceQuestion`/`closeSession`/`currentQuestion`): pending → active →
  closed, with no way to skip a state.
- `tally.ts` — `tallyQuestion()`/`tallySession()`: counts correct/incorrect responses per
  question (deduplicating a re-scanned card, keeping the last scan), and
  `unscannedCards()` to find who hasn't answered yet.

## Where it fits

An L7 module aimed at classrooms without per-learner devices — the whole point is that a
teacher scans a room of physical cards rather than every learner needing a screen.

## Running its tests

```bash
pnpm --filter @infinite-ai/low-tech-assessment test
pnpm --filter @infinite-ai/low-tech-assessment test:coverage
```

Unit tier only, no external services required.
