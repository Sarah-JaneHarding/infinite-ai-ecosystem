import { Card } from '@infinite-ai/design-system';

// This tab used to show ten invented learners (L-001 … L-010) with tiers, EGRA risk flags and
// screening dates, and a tier-distribution bar and KPI tiles computed from them — all of it
// sample data presented as the class's screening results. There is nothing real to show:
// the database holds no screening results or tier placements yet (only the analytics feature
// store), so there is no roster to read, and a tier distribution computed from nothing would
// be as invented as the one it replaces. So the tab says that and shows no learner, no tier
// and no count.

export function MtssOverviewView() {
  return (
    <Card>
      <p role="status" className="text-sm font-semibold text-[var(--iai-text)] mb-2">
        Not available yet
      </p>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-2">
        No universal screening results are stored in the app yet, so there are no learner
        tiers, risk flags or tier counts to show.
      </p>
      <p className="text-sm text-[var(--iai-text-subtle)]">
        This overview will list real results once screening is recorded. Until then it
        shows nothing rather than example learners.
      </p>
    </Card>
  );
}
