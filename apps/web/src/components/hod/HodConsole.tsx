import Link from 'next/link';
import { ModularCard } from '@infinite-ai/design-system';

import { approvalHref, formatOpened, type PendingApproval } from '@/lib/approvals';

interface Props {
  /** Undecided approvals waiting on the HoD role in this tenant, oldest first; `null` when
   * they could not be read (the session carries no tenant), which is not the same as none. */
  readonly pending: readonly PendingApproval[] | null;
}

/** How many to list on the console; the rest are one click away on /approvals. */
const SHOWN = 5;

// Everything here is read from the school's own records, or says plainly that it cannot be.
// There are no placeholder rows: a console that lists a teacher who does not exist, or a
// coverage percentage nobody measured, gets believed.

export function HodConsole({ pending }: Props) {
  const shown = pending?.slice(0, SHOWN) ?? [];
  const more = pending === null ? 0 : pending.length - shown.length;

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
          status={
            pending === null
              ? '—'
              : `${pending.length} ${pending.length === 1 ? 'item' : 'items'}`
          }
        >
          {pending === null ? (
            <p className="text-sm text-[var(--iai-text-subtle)]">
              The list is unavailable: your session has no school attached.
            </p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-[var(--iai-text-subtle)]">
              Nothing is waiting for your decision.
            </p>
          ) : (
            <>
              <ul className="space-y-3" role="list">
                {shown.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--iai-text)]">
                        {item.stepId}
                      </p>
                      <p className="text-xs text-[var(--iai-text-subtle)]">
                        Opened {formatOpened(item.openedAt)}
                      </p>
                    </div>
                    <Link
                      href={approvalHref(item)}
                      className="text-xs text-[var(--iai-primary)] hover:underline"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
              {more > 0 && (
                <p className="mt-3 text-xs text-[var(--iai-text-subtle)]">
                  and {more} more.{' '}
                  <Link
                    href="/approvals"
                    className="text-[var(--iai-primary)] hover:underline"
                  >
                    See all approvals
                  </Link>
                </p>
              )}
            </>
          )}
        </ModularCard>

        <ModularCard
          hue="blue"
          eyebrow="Coverage"
          title="Curriculum progress"
          emoji="📊"
          status="Not available yet"
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            Curriculum coverage is not tracked yet, so there is no progress to show. The
            Annual Teaching Plans themselves are in the Teacher Studio.
          </p>
        </ModularCard>
      </div>
    </section>
  );
}
