# @infinite-ai/learner-client

Learner-facing client data model — the pure-logic data model shared regardless of the
UI choice, since OQ-010 (PWA vs. integrated shell) is still open.

## What's here

- `profile.ts` — `LearnerProfile`, `ActivityRecord`, `GamificationSnapshot` (a lightweight
  mirror of `packages/gamification`'s profile shape, kept separate so this package does
  not take a direct dependency), and the profile helpers (`getRecord`, `upsertRecord`,
  `allCompleted`, `countByStatus`).
- `navigation.ts` — `CourseGraph`/`ActivityNode`, a directed graph of activities
  connected by prerequisite edges, and the pure navigation engine
  (`isUnlocked`/`nextActivities`/`unlockedActivities`/`courseProgress`) that computes
  which activities are unlocked without touching a database.
- `offline.ts` — `OfflineQueue`/`OfflineEvent` and its three payload types
  (`quiz_answered`, `activity_completed`, `assessment_submitted`): the queue model for
  events a learner submits while offline, waiting to be synced. The actual HTTP sync is
  infrastructure; this package owns only the queue data model and its operations
  (`enqueue`/`dequeue`/`peek`/`pendingCount`).

## Where it fits

An L7 module supporting the learner-facing surface (L8, `apps/web`'s `/learner` role).
OQ-010's still-open PWA-vs-shell question is exactly why this package exists
independently — the data model doesn't need to know which UI shell eventually renders it.

## Running its tests

```bash
pnpm --filter @infinite-ai/learner-client test
pnpm --filter @infinite-ai/learner-client test:coverage
```

Unit tier only, no external services required.
