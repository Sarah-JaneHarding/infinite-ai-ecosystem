import { ModularCard } from '@infinite-ai/design-system';
import { StatusPill } from '@infinite-ai/design-system';
import { Badge } from '@infinite-ai/design-system';

const REGISTRY = [
  {
    id: 'CE-01',
    module: 'MOD-01',
    purpose: 'ATP sequencer',
    champion: 'v4',
    evalScore: 0.94,
    status: 'live' as const,
  },
  {
    id: 'TB-01',
    module: 'MOD-04',
    purpose: 'Lesson plan generator',
    champion: 'v7',
    evalScore: 0.91,
    status: 'live' as const,
  },
  {
    id: 'PD-01',
    module: 'MOD-05',
    purpose: 'CPTD artefact',
    champion: 'v3',
    evalScore: 0.88,
    status: 'pending' as const,
  },
];

export function PromptBuilder() {
  return (
    <section aria-labelledby="prompts-heading">
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1
            id="prompts-heading"
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            Prompt Builder
          </h1>
          <p className="text-sm text-[var(--iai-text-subtle)] mt-0.5">
            Browse the registry and propose challengers. Live champions cannot be edited
            directly.
          </p>
        </div>
        <Badge variant="warning">Admin only</Badge>
      </div>

      <ModularCard
        hue="violet"
        eyebrow="Prompt registry"
        title="Champion prompts"
        emoji="🔧"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-[var(--iai-border)]">
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  ID
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Module
                </th>
                <th
                  scope="col"
                  className="text-left py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Purpose
                </th>
                <th
                  scope="col"
                  className="text-right py-2 pr-4 text-xs font-semibold text-[var(--iai-text-subtle)] uppercase tracking-wide"
                >
                  Eval
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
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {REGISTRY.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--iai-border)] last:border-0"
                >
                  <td
                    className="py-2.5 pr-4 font-medium text-[var(--iai-text)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.id}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-[var(--iai-text-subtle)]"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {r.module}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--iai-text-subtle)]">
                    {r.purpose}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-medium"
                    style={{ fontFamily: 'var(--iai-font-mono)' }}
                  >
                    {(r.evalScore * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="py-2.5">
                    {r.status === 'live' ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--iai-primary)] hover:underline"
                        aria-label={`Propose challenger for ${r.id}`}
                      >
                        Propose challenger
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-[var(--iai-text-subtle)] hover:underline"
                        aria-label={`View ratification request for ${r.id}`}
                      >
                        View ratification
                      </button>
                    )}
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
