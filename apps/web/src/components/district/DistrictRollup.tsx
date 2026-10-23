import { Badge, Card } from '@infinite-ai/design-system';

// This page used to list three invented schools ("School A/B/C", 501/387/620 learners, tier
// percentages) under "Aggregated, de-identified data only. Minimum cohort size enforced."
// There is nothing real to show, and nothing here may pretend otherwise:
//  - the platform has no district or cross-school rollup: every table that holds learner or
//    support data is tenant-scoped, and the access policy (`packages/policy` rbac) gives
//    neither platform role any right to read a school's learner records or tier placements;
//  - the "minimum cohort size" the old text promised is a control this page never exercised,
//    and no such rule exists in the codebase, so the page must not assert one.
// A real rollup needs its own decision (what is aggregated, by whom, under what purpose and
// cohort floor), recorded in docs/OPEN_QUESTIONS.md (OQ-034). Until then the page says so.

export function DistrictRollup() {
  return (
    <section aria-labelledby="district-heading">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1
            id="district-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            District Rollup
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            Platform access only.
          </p>
        </div>
        <Badge variant="info">Platform access</Badge>
      </div>

      <Card>
        <p role="status" className="text-sm font-semibold text-[var(--iai-text)] mb-2">
          Not available yet
        </p>
        <p className="text-sm text-[var(--iai-text-subtle)] mb-2">
          There is no district rollup. Each school&rsquo;s learner data stays with that
          school, and nothing combines it across schools.
        </p>
        <p className="text-sm text-[var(--iai-text-subtle)]">
          A rollup would need a decision on what is counted, for what purpose, and the
          smallest group that may be reported. That decision has not been made, so there
          is nothing to show here.
        </p>
      </Card>
    </section>
  );
}
