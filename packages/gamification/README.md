# @infinite-ai/gamification

Game-Based Learning — the event-driven XP, badge, level and streak engine behind the
learner client. Pure logic; no direct database access, no I/O.

## What's here

- `events.ts` — the `GamificationEvent` discriminated union (`lesson_completed`,
  `assessment_completed`, `assessment_passed`, `learning_streak_day`,
  `module_completed`, `gate_approved`) and `LearnerGamificationProfile`, the input state
  `processEvent` trusts.
- `points.ts` — `XP_VALUES`, `LEVEL_THRESHOLDS`, `computeLevel()`, and the per-event-type
  XP calculators (high-score and streak-milestone bonuses included).
- `badges.ts` — `BADGE_CATALOGUE` and `evaluateBadges()`: a badge is awarded when the
  learner doesn't already hold it, their new level clears the badge's own `minLevel`
  gate, and the event satisfies the badge's trigger condition.
- `engine.ts` — `processEvent()`, the single function that ties points and badges
  together: event + current profile in, a `GamificationUpdate` (XP earned, new
  level/streak, newly-awarded badges) out.

## Where it fits

An L7 module. `packages/learner-client` carries a lightweight `GamificationSnapshot` of
this package's output rather than depending on it directly, so the learner-facing UI
doesn't need this engine's full event-processing surface.

## Running its tests

```bash
pnpm --filter @infinite-ai/gamification test
pnpm --filter @infinite-ai/gamification test:coverage
```

Unit tier only, no external services required.
