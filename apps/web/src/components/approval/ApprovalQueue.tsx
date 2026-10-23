import Link from 'next/link';
import { approvalHref, formatOpened, type PendingApproval } from '@/lib/approvals';

interface Props {
  readonly items: readonly PendingApproval[];
  readonly role: string;
}

const TH =
  'text-left text-xs font-semibold uppercase tracking-wide px-3 py-2.5 border-b border-[var(--iai-border)] whitespace-nowrap';

export function ApprovalQueue({ items, role }: Props) {
  return (
    <section aria-labelledby="approvals-heading">
      <h1
        id="approvals-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-1"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        Approvals
      </h1>
      <p className="text-sm text-[var(--iai-text-subtle)] mb-6">
        Work waiting for a decision from your role ({role}). Nothing here is applied until
        a person decides it.
      </p>

      {items.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-[var(--iai-border)] px-4 py-10 text-center text-sm text-[var(--iai-text-subtle)]"
        >
          Nothing is waiting for your decision.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--iai-border)]">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Pending approvals</caption>
            <thead>
              <tr className="bg-[var(--iai-surface-raised)] text-[var(--iai-text-subtle)]">
                <th scope="col" className={TH}>
                  Step
                </th>
                <th scope="col" className={TH}>
                  Opened
                </th>
                <th scope="col" className={TH}>
                  Task
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--iai-border)]">
                  <td className="px-3 py-2 font-medium text-[var(--iai-text)]">
                    {item.stepId}
                  </td>
                  <td className="px-3 py-2 text-[var(--iai-text-subtle)] whitespace-nowrap">
                    {formatOpened(item.openedAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--iai-text-subtle)]">
                    {item.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={approvalHref(item)}
                      className="text-[var(--iai-primary)] hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
