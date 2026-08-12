import { Card } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';

const SCHOOLS = [
  { name: 'School A', tenants: 501, tier1Pct: 81, tier2Pct: 14, tier3Pct: 5 },
  { name: 'School B', tenants: 387, tier1Pct: 84, tier2Pct: 12, tier3Pct: 4 },
  { name: 'School C', tenants: 620, tier1Pct: 79, tier2Pct: 16, tier3Pct: 5 },
];

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
            Aggregated, de-identified data only. Minimum cohort size enforced.
          </p>
        </div>
        <Badge variant="info">De-identified</Badge>
      </div>

      <div className="overflow-x-auto">
        <Card>
          <table className="w-full text-sm" role="table">
            <caption className="sr-only">Learner tier distribution by school</caption>
            <thead>
              <tr className="border-b border-[var(--iai-border)]">
                <th
                  scope="col"
                  className="text-left py-2 pr-6 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  School
                </th>
                <th
                  scope="col"
                  className="text-right py-2 pr-6 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Learners
                </th>
                <th
                  scope="col"
                  className="text-right py-2 pr-6 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  T1
                </th>
                <th
                  scope="col"
                  className="text-right py-2 pr-6 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  T2
                </th>
                <th
                  scope="col"
                  className="text-right py-2 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  T3
                </th>
              </tr>
            </thead>
            <tbody>
              {SCHOOLS.map((s) => (
                <tr
                  key={s.name}
                  className="border-b border-[var(--iai-border)] last:border-0"
                >
                  <td className="py-2.5 pr-6 font-medium text-[var(--iai-text)]">
                    {s.name}
                  </td>
                  <td className="py-2.5 pr-6 text-right text-[var(--iai-text-subtle)]">
                    {s.tenants.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-6 text-right text-[var(--iai-text-subtle)]">
                    {s.tier1Pct}%
                  </td>
                  <td className="py-2.5 pr-6 text-right text-[var(--iai-text-subtle)]">
                    {s.tier2Pct}%
                  </td>
                  <td className="py-2.5 text-right text-[var(--iai-text-subtle)]">
                    {s.tier3Pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}
