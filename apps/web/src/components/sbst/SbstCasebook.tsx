import { ModularCard } from '@infinite-ai/design-system';
import { StatusPill } from '@infinite-ai/design-system';

const CASES = [
  {
    id: 'c1',
    ref: 'SIAS-001',
    phase: 'Phase 2',
    stage: 'Assessment',
    status: 'pending' as const,
    next: '2026-08-20',
  },
  {
    id: 'c2',
    ref: 'SIAS-002',
    phase: 'Phase 3',
    stage: 'Intervention',
    status: 'approved' as const,
    next: '2026-08-18',
  },
  {
    id: 'c3',
    ref: 'SIAS-003',
    phase: 'Phase 1',
    stage: 'Screening',
    status: 'draft' as const,
    next: '2026-08-22',
  },
];

export function SbstCasebook() {
  return (
    <section aria-labelledby="sbst-heading">
      <h1
        id="sbst-heading"
        className="text-2xl font-bold text-[var(--iai-text)] mb-6"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        SBST Casebook
      </h1>

      <ModularCard hue="green" eyebrow="SIAS cases" title="Active case files" emoji="📁">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-[var(--iai-border)]">
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Ref
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Phase
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Stage
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="text-left py-2 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Next review
                </th>
              </tr>
            </thead>
            <tbody>
              {CASES.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--iai-border)] last:border-0"
                >
                  <td
                    className="py-2.5 pr-4 font-medium text-[var(--iai-text)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {c.ref}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--iai-text-subtle)]">{c.phase}</td>
                  <td className="py-2.5 pr-4 text-[var(--iai-text-subtle)]">{c.stage}</td>
                  <td className="py-2.5 pr-4">
                    <StatusPill status={c.status} />
                  </td>
                  <td
                    className="py-2.5 text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {c.next}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModularCard>
    </section>
  );
}
