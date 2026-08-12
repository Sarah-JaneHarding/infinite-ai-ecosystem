import { ModularCard } from '@infinite-ai/design-system';
import { StatusPill } from '@infinite-ai/design-system';
import Link from 'next/link';

const PENDING_APPROVALS = [
  {
    id: 'a1',
    type: 'Lesson plan',
    teacher: 'Ms Nkosi',
    subject: 'Mathematics Gr 8',
    status: 'pending' as const,
  },
  {
    id: 'a2',
    type: 'Assessment',
    teacher: 'Mr Dlamini',
    subject: 'Physics Gr 11',
    status: 'pending' as const,
  },
];

const COVERAGE = [
  { subject: 'Mathematics', complete: 72, total: 100 },
  { subject: 'Physics', complete: 58, total: 100 },
  { subject: 'Life Sci.', complete: 83, total: 100 },
];

export function HodConsole() {
  return (
    <section aria-labelledby="hod-heading">
      <h1
        id="hod-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-6"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        HoD Console
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ModularCard
          hue="teal"
          eyebrow="Approvals"
          title="Pending review"
          emoji="✅"
          status={`${PENDING_APPROVALS.length} items`}
        >
          <ul className="space-y-3" role="list">
            {PENDING_APPROVALS.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--iai-text)]">
                    {item.type}
                  </p>
                  <p className="text-xs text-[var(--iai-text-subtle)]">
                    {item.teacher} · {item.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={item.status} />
                  <Link
                    href={`/approvals/${item.id}`}
                    className="text-xs text-[var(--iai-primary)] hover:underline"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </ModularCard>

        <ModularCard hue="blue" eyebrow="Coverage" title="Curriculum progress" emoji="📊">
          <ul className="space-y-3" role="list">
            {COVERAGE.map((item) => (
              <li key={item.subject}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--iai-text)]">
                    {item.subject}
                  </span>
                  <span className="text-[var(--iai-text-subtle)]">{item.complete}%</span>
                </div>
                <div
                  className="h-2 rounded-full bg-[var(--iai-bg-subtle)] border border-[var(--iai-border)]"
                  role="progressbar"
                  aria-valuenow={item.complete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.subject} curriculum coverage`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--iai-teal)]"
                    style={{ width: `${item.complete}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </ModularCard>
      </div>
    </section>
  );
}
