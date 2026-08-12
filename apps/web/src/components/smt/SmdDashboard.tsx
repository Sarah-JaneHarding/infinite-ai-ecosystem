import { ModularCard } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';

const TIERS = [
  { label: 'Tier 1 — Universal', count: 412, pct: 82 },
  { label: 'Tier 2 — Targeted', count: 71, pct: 14 },
  { label: 'Tier 3 — Intensive', count: 18, pct: 4 },
];

export function SmdDashboard() {
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
          eyebrow="System"
          title="Health"
          emoji="🩺"
          status="Operational"
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            All modules running. No active incidents.
          </p>
        </ModularCard>

        <ModularCard
          hue="teal"
          eyebrow="Support tiers"
          title="Learner distribution"
          emoji="👥"
        >
          <dl className="space-y-2">
            {TIERS.map((t) => (
              <div key={t.label} className="flex items-center justify-between text-xs">
                <dt className="text-[var(--iai-text-subtle)]">{t.label}</dt>
                <dd className="font-medium text-[var(--iai-text)]">
                  {t.count} <Badge variant="default">{t.pct}%</Badge>
                </dd>
              </div>
            ))}
          </dl>
        </ModularCard>

        <ModularCard
          hue="blue"
          eyebrow="PD Studio"
          title="Professional development"
          emoji="🎓"
        >
          <p className="text-sm text-[var(--iai-text-subtle)]">
            3 teachers have pending CPTD artefacts.
          </p>
        </ModularCard>
      </div>
    </section>
  );
}
