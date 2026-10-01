import Link from 'next/link';
import { ModularCard } from '@infinite-ai/design-system';

interface Props {
  /** Undecided approvals waiting on the SMT role in this tenant; `null` when the count
   * could not be read (the session carries no tenant), which is not the same as none. */
  readonly pendingApprovals: number | null;
}

// Everything on this page is read from the school's own records, or says plainly that it
// cannot be. There are no placeholder figures: a leadership dashboard that shows a made-up
// learner count or a green "all systems operational" is worse than an empty one, because it
// gets believed.

export function SmdDashboard({ pendingApprovals }: Props) {
  return (
    <section aria-labelledby="smt-heading">
      <h1
        id="smt-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-6"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        SMT Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ModularCard
          hue="indigo"
          eyebrow="Approvals"
          title="Awaiting your decision"
          emoji="✅"
          status={pendingApprovals === null ? '—' : String(pendingApprovals)}
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            {pendingApprovals === null
              ? 'The count is unavailable: your session has no school attached.'
              : pendingApprovals === 0
                ? 'Nothing is waiting for you.'
                : `${pendingApprovals} ${pendingApprovals === 1 ? 'item is' : 'items are'} waiting for a decision from your role.`}
          </p>
          <Link
            href="/approvals"
            className="mt-2 inline-block text-xs text-[var(--iai-primary)] hover:underline"
          >
            Open approvals
          </Link>
        </ModularCard>

        <ModularCard
          hue="teal"
          eyebrow="Support tiers"
          title="Learner distribution"
          emoji="👥"
          status="Not available yet"
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            Support tiers are not set up for your school, so there is no distribution to
            show.
          </p>
        </ModularCard>

        <ModularCard
          hue="blue"
          eyebrow="PD Studio"
          title="Professional development"
          emoji="🎓"
          status="Not available yet"
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            Professional development records are not connected yet, so nothing is counted
            here.
          </p>
        </ModularCard>
      </div>
    </section>
  );
}
