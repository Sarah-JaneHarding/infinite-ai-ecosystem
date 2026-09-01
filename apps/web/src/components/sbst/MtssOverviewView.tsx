'use client';

// Tier thresholds follow the RTI/MTSS three-tier model:
// Tier 1 = universal (all learners, ≥ 80 % benchmark); Tier 2 = strategic support (~15 %);
// Tier 3 = intensive intervention (~5 %).

const TIER_COLOUR = {
  1: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0', label: 'Tier 1 — On track' },
  2: { bg: '#fef9c3', text: '#854d0e', border: '#fde68a', label: 'Tier 2 — Strategic' },
  3: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', label: 'Tier 3 — Intensive' },
} as const;

interface LearnerRow {
  token: string;
  grade: string;
  tier: 1 | 2 | 3;
  riskFlags: readonly string[];
  lastScreened: string;
}

const MOCK_ROSTER: LearnerRow[] = [
  {
    token: 'L-001',
    grade: 'Grade 2',
    tier: 1,
    riskFlags: [],
    lastScreened: '2026-08-12',
  },
  {
    token: 'L-002',
    grade: 'Grade 2',
    tier: 2,
    riskFlags: ['ORF', 'RC'],
    lastScreened: '2026-08-12',
  },
  {
    token: 'L-003',
    grade: 'Grade 3',
    tier: 3,
    riskFlags: ['LSI', 'NWF', 'ORF', 'RC'],
    lastScreened: '2026-08-13',
  },
  {
    token: 'L-004',
    grade: 'Grade 2',
    tier: 1,
    riskFlags: [],
    lastScreened: '2026-08-12',
  },
  {
    token: 'L-005',
    grade: 'Grade 3',
    tier: 2,
    riskFlags: ['PA', 'LC'],
    lastScreened: '2026-08-13',
  },
  {
    token: 'L-006',
    grade: 'Grade 3',
    tier: 1,
    riskFlags: [],
    lastScreened: '2026-08-13',
  },
  {
    token: 'L-007',
    grade: 'Grade 2',
    tier: 3,
    riskFlags: ['LSI', 'NWF', 'WR', 'ORF'],
    lastScreened: '2026-08-12',
  },
  {
    token: 'L-008',
    grade: 'Grade 4',
    tier: 1,
    riskFlags: [],
    lastScreened: '2026-08-14',
  },
  {
    token: 'L-009',
    grade: 'Grade 4',
    tier: 2,
    riskFlags: ['RC'],
    lastScreened: '2026-08-14',
  },
  {
    token: 'L-010',
    grade: 'Grade 3',
    tier: 1,
    riskFlags: [],
    lastScreened: '2026-08-13',
  },
];

interface KpiTileProps {
  value: number;
  label: string;
  colour: string;
}

function KpiTile({ value, label, colour }: KpiTileProps) {
  return (
    <div
      className="rounded-[var(--iai-radius-xl)] border p-5 text-center"
      style={{ borderColor: 'var(--iai-border)', background: colour }}
    >
      <p
        className="text-3xl font-bold"
        style={{ fontFamily: 'var(--iai-font-title)', color: 'var(--iai-text)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--iai-text-subtle)' }}>
        {label}
      </p>
    </div>
  );
}

export function MtssOverviewView() {
  const total = MOCK_ROSTER.length;
  const tier2 = MOCK_ROSTER.filter((r) => r.tier === 2).length;
  const tier3 = MOCK_ROSTER.filter((r) => r.tier === 3).length;
  const atRisk = tier2 + tier3;

  const tier1Pct = Math.round(((total - atRisk) / total) * 100);
  const tier2Pct = Math.round((tier2 / total) * 100);
  const tier3Pct = Math.round((tier3 / total) * 100);

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile value={total} label="Learners screened" colour="var(--iai-bg-subtle)" />
        <KpiTile value={atRisk} label="At risk (any flag)" colour="#fef9c3" />
        <KpiTile value={tier2} label="Tier 2 — strategic" colour="#fef3c7" />
        <KpiTile value={tier3} label="Tier 3 — intensive" colour="#fee2e2" />
      </div>

      {/* Tier funnel bar */}
      <div
        className="rounded-[var(--iai-radius-xl)] border p-5"
        style={{ borderColor: 'var(--iai-border)', background: 'var(--iai-bg)' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--iai-text)' }}>
          MTSS tier distribution
        </p>
        <div className="flex rounded-full overflow-hidden h-7 text-xs font-bold text-white select-none">
          <div
            className="flex items-center justify-center"
            style={{ width: `${tier1Pct}%`, background: '#2db24c' }}
            title={`Tier 1 — ${tier1Pct}%`}
          >
            {tier1Pct >= 12 ? `T1 ${tier1Pct}%` : ''}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${tier2Pct}%`, background: '#c99400' }}
            title={`Tier 2 — ${tier2Pct}%`}
          >
            {tier2Pct >= 8 ? `T2 ${tier2Pct}%` : ''}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${tier3Pct}%`, background: '#e8273c' }}
            title={`Tier 3 — ${tier3Pct}%`}
          >
            {tier3Pct >= 8 ? `T3 ${tier3Pct}%` : ''}
          </div>
        </div>
        <div className="flex gap-4 mt-3">
          {([1, 2, 3] as const).map((t) => {
            const c = TIER_COLOUR[t];
            return (
              <span
                key={t}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--iai-text-subtle)' }}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    background: t === 1 ? '#2db24c' : t === 2 ? '#c99400' : '#e8273c',
                  }}
                />
                {c.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Roster table */}
      <div
        className="rounded-[var(--iai-radius-xl)] border overflow-hidden"
        style={{ borderColor: 'var(--iai-border)', background: 'var(--iai-bg)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--iai-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--iai-text)' }}>
            Class roster — universal screening results
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--iai-text-subtle)' }}>
            Learner tokens shown — no personal information displayed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--iai-bg-subtle)' }}>
                {['Token', 'Grade', 'Tier', 'EGRA risk flags', 'Screened'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      color: 'var(--iai-text-subtle)',
                      fontFamily: 'var(--iai-font-mono)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_ROSTER.map((r) => {
                const c = TIER_COLOUR[r.tier];
                return (
                  <tr
                    key={r.token}
                    className="border-t"
                    style={{ borderColor: 'var(--iai-border)' }}
                  >
                    <td
                      className="px-4 py-2.5 font-medium"
                      style={{
                        color: 'var(--iai-text)',
                        fontFamily: 'var(--iai-font-mono)',
                      }}
                    >
                      {r.token}
                    </td>
                    <td
                      className="px-4 py-2.5"
                      style={{ color: 'var(--iai-text-subtle)' }}
                    >
                      {r.grade}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        Tier {r.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.riskFlags.length === 0 ? (
                        <span
                          className="text-xs"
                          style={{ color: 'var(--iai-text-subtle)' }}
                        >
                          None
                        </span>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {r.riskFlags.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                fontFamily: 'var(--iai-font-mono)',
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td
                      className="px-4 py-2.5"
                      style={{
                        color: 'var(--iai-text-subtle)',
                        fontFamily: 'var(--iai-font-mono)',
                      }}
                    >
                      {r.lastScreened}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
